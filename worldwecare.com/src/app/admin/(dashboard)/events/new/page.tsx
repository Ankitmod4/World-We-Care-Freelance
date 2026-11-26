import type { Metadata } from "next";
import { EventForm } from "../event-form";

export const metadata: Metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <EventForm />
    </div>
  );
}
