export const taskStatusLabel = (status: string): string => {
  if (status === "todo") return "Upcoming";
  if (status === "in_progress") return "In progress";
  if (status === "done") return "Done";
  if (status === "cancelled") return "Cancelled";
  return status.replace(/_/g, " ");
};

export const formatEstimate = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
};

export const isSameLocalDay = (iso: string, day: Date): boolean => {
  const value = new Date(iso);
  return (
    value.getFullYear() === day.getFullYear() &&
    value.getMonth() === day.getMonth() &&
    value.getDate() === day.getDate()
  );
};

export const formatScheduledAt = (iso: string | null): string => {
  if (!iso) return "Not scheduled";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};
