import type { Metadata } from "next";
import { EventForm } from "../event-form";
import { getAdminEvent } from "@/lib/events";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getAdminEvent(id);
  return { title: event ? event.title : "Event" };
}

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <EventForm eventId={id} />
    </div>
  );
}
