"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function assignSlot(
  userId: number,
  projectId: number,
  date: string,
  period: "AM" | "PM",
) {
  await prisma.halfDaySlot.upsert({
    where: {
      userId_date_period: {
        userId,
        date: new Date(date),
        period,
      },
    },
    update: { projectId },
    create: {
      userId,
      projectId,
      date: new Date(date),
      period,
    },
  });

  revalidatePath("/projets/disponibilite-equipe");
}

export async function removeSlot(
  userId: number,
  date: string,
  period: "AM" | "PM",
) {
  await prisma.halfDaySlot.deleteMany({
    where: {
      userId,
      date: new Date(date),
      period,
    },
  });

  revalidatePath("/projets/disponibilite-equipe");
}

export async function bulkAssignWeek(
  userId: number,
  projectId: number,
  weekMonday: string,
) {
  const monday = new Date(weekMonday);
  const slots: { date: Date; period: "AM" | "PM" }[] = [];
  for (let d = 0; d < 5; d++) {
    const date = new Date(monday);
    date.setDate(date.getDate() + d);
    slots.push({ date, period: "AM" });
    slots.push({ date, period: "PM" });
  }

  for (const slot of slots) {
    await prisma.halfDaySlot.upsert({
      where: {
        userId_date_period: {
          userId,
          date: slot.date,
          period: slot.period,
        },
      },
      update: { projectId },
      create: {
        userId,
        projectId,
        date: slot.date,
        period: slot.period,
      },
    });
  }

  revalidatePath("/projets/disponibilite-equipe");
}

export async function clearWeek(userId: number, weekMonday: string) {
  const monday = new Date(weekMonday);
  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);

  await prisma.halfDaySlot.deleteMany({
    where: {
      userId,
      date: { gte: monday, lte: friday },
    },
  });

  revalidatePath("/projets/disponibilite-equipe");
}
