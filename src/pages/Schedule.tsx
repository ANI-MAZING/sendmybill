import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { ErrorState, PageLoader } from "@/components/shared/AsyncState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEstimate, formatScheduledAt, taskStatusLabel } from "@/lib/schedule";

type Task = Pick<Tables<"project_tasks">, "id" | "project_id" | "title" | "status" | "scheduled_at" | "estimated_minutes" | "is_deliverable">;
type Project = Pick<Tables<"projects">, "id" | "name" | "client_id">;
type Client = Pick<Tables<"clients">, "id" | "client_name">;

const Schedule = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [taskResult, projectResult, clientResult] = await Promise.all([
      supabase.from("project_tasks").select("id, project_id, title, status, scheduled_at, estimated_minutes, is_deliverable").neq("status", "cancelled"),
      supabase.from("projects").select("id, name, client_id"),
      supabase.from("clients").select("id, client_name"),
    ]);
    if (taskResult.error || projectResult.error || clientResult.error) {
      setError("The schedule couldn’t be loaded. Check your connection and try again.");
    } else {
      setTasks(taskResult.data ?? []);
      setProjects(projectResult.data ?? []);
      setClients(clientResult.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => {
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const clientById = new Map(clients.map((client) => [client.id, client]));
    const byClient = new Map<string, { clientId: string; clientName: string; tasks: Array<Task & { projectName: string }> }>();

    for (const task of tasks) {
      const project = projectById.get(task.project_id);
      const clientId = project?.client_id ?? "unknown";
      const clientName = clientById.get(clientId)?.client_name ?? "Unknown client";
      const group = byClient.get(clientId) ?? { clientId, clientName, tasks: [] };
      group.tasks.push({ ...task, projectName: project?.name ?? "Project" });
      byClient.set(clientId, group);
    }

    return [...byClient.values()]
      .map((group) => ({
        ...group,
        tasks: group.tasks.sort((left, right) => (left.scheduled_at ?? "9999").localeCompare(right.scheduled_at ?? "9999")),
      }))
      .sort((left, right) => left.clientName.localeCompare(right.clientName));
  }, [clients, projects, tasks]);

  if (loading) return <DashboardLayout><PageLoader label="Loading schedule…" /></DashboardLayout>;
  if (error) return <DashboardLayout><ErrorState message={error} onRetry={() => void load()} /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Schedule</h1>
          <p className="mt-1 text-muted-foreground">Upcoming work across clients, with when it starts and how long it should take.</p>
        </div>
        {groups.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center">
              <CalendarClock className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
              <p>No scheduled work yet. Open a client project and add a task with a start time.</p>
            </CardContent>
          </Card>
        ) : groups.map((group) => (
          <Card key={group.clientId}>
            <CardHeader>
              <CardTitle>
                <button className="hover:underline" onClick={() => group.clientId !== "unknown" && navigate(`/dashboard/clients/${group.clientId}`)}>{group.clientName}</button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {group.tasks.map((task) => (
                <button key={task.id} className="flex w-full items-center justify-between gap-3 border-b py-3 text-left last:border-0" onClick={() => navigate(`/dashboard/projects/${task.project_id}`)}>
                  <span>
                    <span className="font-medium">{task.is_deliverable ? "Deliverable: " : ""}{task.title}</span>
                    <span className="block text-sm text-muted-foreground">{task.projectName} · {formatScheduledAt(task.scheduled_at)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{formatEstimate(task.estimated_minutes)}</span>
                    <Badge variant="outline">{taskStatusLabel(task.status)}</Badge>
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default Schedule;
