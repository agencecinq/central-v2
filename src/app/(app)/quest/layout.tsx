export default function QuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Override background to black for the quest section
  return <div className="bg-black min-h-[calc(100vh-3.5rem)] -mx-6 -my-8 px-6 py-8">{children}</div>;
}
