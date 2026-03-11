-- ============================================================
-- CinqCentral V1 → V2 Migration Script (MySQL / MariaDB)
-- ============================================================
-- AVANT D'EXÉCUTER : faire un backup complet de la BDD
-- mysqldump -u USER -p DATABASE > backup_avant_v2.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TABLE users : convertir role enum → varchar
-- ────────────────────────────────────────────────────────────
ALTER TABLE `users`
  MODIFY COLUMN `role` VARCHAR(50) NOT NULL DEFAULT 'equipe';

-- Renommer les rôles V1 → V2
UPDATE `users` SET `role` = 'equipe' WHERE `role` IN ('pm', 'commercial');

-- ────────────────────────────────────────────────────────────
-- 2. TABLE tickets : restructurer complètement
-- ────────────────────────────────────────────────────────────
-- Renommer user_id → createur_id
ALTER TABLE `tickets`
  CHANGE COLUMN `user_id` `createur_id` BIGINT(20) UNSIGNED DEFAULT NULL;

-- Ajouter les nouvelles colonnes
ALTER TABLE `tickets`
  ADD COLUMN `assigne_id` BIGINT(20) UNSIGNED DEFAULT NULL AFTER `createur_id`,
  ADD COLUMN `statut` VARCHAR(50) NOT NULL DEFAULT 'ouvert' AFTER `description`,
  ADD COLUMN `navigateur` VARCHAR(255) DEFAULT NULL AFTER `statut`,
  ADD COLUMN `taille_ecran` VARCHAR(50) DEFAULT NULL AFTER `navigateur`,
  ADD COLUMN `meta_info` TEXT DEFAULT NULL AFTER `taille_ecran`;

-- Migrer les données existantes : est_resolu → statut
UPDATE `tickets` SET `statut` = 'resolu' WHERE `est_resolu` = 1;
UPDATE `tickets` SET `statut` = 'ouvert' WHERE `est_resolu` = 0;

-- Migrer lien vers meta_info (JSON)
UPDATE `tickets`
  SET `meta_info` = JSON_OBJECT('origin', `lien`, 'source', `type`)
  WHERE `lien` IS NOT NULL;
UPDATE `tickets`
  SET `meta_info` = JSON_OBJECT('source', `type`)
  WHERE `lien` IS NULL AND `type` IS NOT NULL;

-- Assigner les tickets au chef de projet du projet
UPDATE `tickets` t
  JOIN `projects` p ON t.`project_id` = p.`id`
  SET t.`assigne_id` = p.`chef_projet_id`
  WHERE p.`chef_projet_id` IS NOT NULL;

-- Supprimer les anciennes colonnes
ALTER TABLE `tickets`
  DROP COLUMN `lien`,
  DROP COLUMN `position_x`,
  DROP COLUMN `position_y`,
  DROP COLUMN `type`,
  DROP COLUMN `est_resolu`,
  DROP COLUMN `date_resolution`;

-- Ajouter les index / foreign keys
ALTER TABLE `tickets`
  ADD INDEX `tickets_assigne_id_index` (`assigne_id`),
  ADD CONSTRAINT `tickets_assigne_id_foreign`
    FOREIGN KEY (`assigne_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- 3. TABLE ticket_files → ticket_attachments (renommer + colonnes)
-- ────────────────────────────────────────────────────────────
RENAME TABLE `ticket_files` TO `ticket_attachments`;

ALTER TABLE `ticket_attachments`
  CHANGE COLUMN `name` `filename` VARCHAR(255) NOT NULL,
  CHANGE COLUMN `path` `filepath` VARCHAR(255) NOT NULL,
  CHANGE COLUMN `mime_type` `mimetype` VARCHAR(255) DEFAULT NULL,
  DROP COLUMN `updated_at`;

-- Ajouter ON DELETE CASCADE
ALTER TABLE `ticket_attachments`
  DROP FOREIGN KEY IF EXISTS `ticket_files_ticket_id_foreign`,
  ADD CONSTRAINT `ticket_attachments_ticket_id_foreign`
    FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`)
    ON DELETE CASCADE;

-- ────────────────────────────────────────────────────────────
-- 4. TABLE tasks : ajouter allocation_id
-- ────────────────────────────────────────────────────────────
ALTER TABLE `tasks`
  ADD COLUMN `allocation_id` BIGINT(20) UNSIGNED DEFAULT NULL AFTER `is_backlog`;

-- Convertir categorie et priorite d'enum à varchar
ALTER TABLE `tasks`
  MODIFY COLUMN `categorie` VARCHAR(255) DEFAULT NULL,
  MODIFY COLUMN `priorite` VARCHAR(50) NOT NULL DEFAULT 'moyenne',
  MODIFY COLUMN `statut_kanban` VARCHAR(50) NOT NULL DEFAULT 'todo';

-- ────────────────────────────────────────────────────────────
-- 5. TABLE deals : convertir etape d'enum à varchar
-- ────────────────────────────────────────────────────────────
ALTER TABLE `deals`
  MODIFY COLUMN `etape` VARCHAR(50) NOT NULL DEFAULT 'Prospect';

-- ────────────────────────────────────────────────────────────
-- 6. TABLE projects : convertir statut d'enum à varchar
-- ────────────────────────────────────────────────────────────
ALTER TABLE `projects`
  MODIFY COLUMN `statut` VARCHAR(50) NOT NULL DEFAULT 'en_attente';

-- ────────────────────────────────────────────────────────────
-- 7. TABLE clients : convertir statut d'enum à varchar
-- ────────────────────────────────────────────────────────────
ALTER TABLE `clients`
  MODIFY COLUMN `statut` VARCHAR(50) NOT NULL DEFAULT 'prospect';

-- ────────────────────────────────────────────────────────────
-- 8. TABLE transactions : convertir type et statut d'enum à varchar
-- ────────────────────────────────────────────────────────────
ALTER TABLE `transactions`
  MODIFY COLUMN `type` VARCHAR(50) NOT NULL,
  MODIFY COLUMN `statut` VARCHAR(50) DEFAULT NULL;

-- ────────────────────────────────────────────────────────────
-- 9. NOUVELLES TABLES V2
-- ────────────────────────────────────────────────────────────

-- Métiers (catégories de compétences)
CREATE TABLE IF NOT EXISTS `metiers` (
  `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `nom` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `metiers_nom_unique` (`nom`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Association users ↔ métiers
CREATE TABLE IF NOT EXISTS `user_metiers` (
  `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT(20) UNSIGNED NOT NULL,
  `metier_id` BIGINT(20) UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_metiers_user_metier_unique` (`user_id`, `metier_id`),
  CONSTRAINT `user_metiers_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `user_metiers_metier_id_foreign` FOREIGN KEY (`metier_id`) REFERENCES `metiers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Allocations projet (phases/métiers par projet)
CREATE TABLE IF NOT EXISTS `project_allocations` (
  `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id` BIGINT(20) UNSIGNED NOT NULL,
  `metier_id` BIGINT(20) UNSIGNED NOT NULL,
  `jours_prevus` DECIMAL(8,2) NOT NULL DEFAULT 0,
  `date_debut` DATE DEFAULT NULL,
  `date_fin` DATE DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `project_allocations_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `project_allocations_metier_id_foreign` FOREIGN KEY (`metier_id`) REFERENCES `metiers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ajouter FK allocation_id sur tasks
ALTER TABLE `tasks`
  ADD CONSTRAINT `tasks_allocation_id_foreign`
    FOREIGN KEY (`allocation_id`) REFERENCES `project_allocations` (`id`)
    ON DELETE SET NULL;

-- Time entries V2 (timetracking par semaine)
CREATE TABLE IF NOT EXISTS `time_entries_v2` (
  `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT(20) UNSIGNED NOT NULL,
  `project_id` BIGINT(20) UNSIGNED DEFAULT NULL,
  `task_id` BIGINT(20) UNSIGNED DEFAULT NULL,
  `semaine` VARCHAR(10) NOT NULL COMMENT 'ISO week, e.g. 2026-W11',
  `duree` DECIMAL(8,2) NOT NULL,
  `unite` VARCHAR(20) NOT NULL DEFAULT 'heures',
  `categorie` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `time_entries_v2_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `time_entries_v2_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `time_entries_v2_task_id_foreign` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Factures deal (cache Qonto)
CREATE TABLE IF NOT EXISTS `deal_factures` (
  `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `deal_id` BIGINT(20) UNSIGNED NOT NULL,
  `qonto_invoice_id` VARCHAR(255) NOT NULL,
  `numero` VARCHAR(255) NOT NULL,
  `client_nom` VARCHAR(255) NOT NULL,
  `montant_ht` DECIMAL(15,2) NOT NULL,
  `date_facture` DATE DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `deal_factures_deal_qonto_unique` (`deal_id`, `qonto_invoice_id`),
  CONSTRAINT `deal_factures_deal_id_foreign` FOREIGN KEY (`deal_id`) REFERENCES `deals` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Prévisionnel dépenses V2
CREATE TABLE IF NOT EXISTS `forecast_expenses_v2` (
  `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `categorie` VARCHAR(255) NOT NULL,
  `mois` VARCHAR(10) NOT NULL DEFAULT '',
  `mois_fin` VARCHAR(10) DEFAULT NULL,
  `libelle` VARCHAR(255) NOT NULL,
  `montant` DECIMAL(10,2) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Prévisionnel revenu par deal
CREATE TABLE IF NOT EXISTS `deal_revenu_planifie` (
  `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `deal_id` BIGINT(20) UNSIGNED NOT NULL,
  `mois` VARCHAR(10) NOT NULL,
  `montant_ht` DECIMAL(15,2) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `deal_revenu_planifie_deal_mois_unique` (`deal_id`, `mois`),
  CONSTRAINT `deal_revenu_planifie_deal_id_foreign` FOREIGN KEY (`deal_id`) REFERENCES `deals` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Planification factures
CREATE TABLE IF NOT EXISTS `invoice_planification` (
  `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `numero` VARCHAR(255) NOT NULL,
  `mois` VARCHAR(10) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoice_planification_numero_unique` (`numero`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- FIN DE LA MIGRATION
-- ============================================================
