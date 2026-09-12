import { useState } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, ClipboardList } from "lucide-react";
import { TaskCard } from "@/components/TaskCard";
import { WoopWizard } from "@/components/WoopWizard";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useLanguage } from "@/context/LanguageContext";

export default function TasksPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: tasks, isLoading } = useTasks();
  const [wizardOpen, setWizardOpen] = useState(false);

  const handleCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks", user?.id ?? ""] });
    setWizardOpen(false);
  };

  return (
    <motion.div
      className="bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-3 pb-8">
        {isLoading ? (
          <div className="text-center py-12 text-[#7A8A72]">{t("tasks.loading")}</div>
        ) : !tasks || tasks.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 px-6" data-testid="tasks-empty-state">
            <div className="w-[120px] h-[120px] rounded-full bg-[#2D3A2E] flex items-center justify-center mb-6">
              <ClipboardList className="w-16 h-16 text-[#8FA680]" />
            </div>
            <h2 className="font-heading font-bold text-xl text-[#E8EDE3]">{t("tasks.empty.title")}</h2>
            <p className="text-[#A3B197] mt-2 mb-7 max-w-xs leading-relaxed">
              {t("tasks.empty.body")}
            </p>
            <button
              onClick={() => setWizardOpen(true)}
              className="h-11 px-6 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors duration-300 flex items-center gap-2"
              data-testid="button-create-first"
            >
              <Plus className="w-4 h-4" /> {t("tasks.empty.cta")}
            </button>
          </div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </main>

      <button
        onClick={() => setWizardOpen(true)}
        className="fixed bottom-24 right-5 z-30 w-14 h-14 rounded-full bg-[#4A5D3E] text-[#E8EDE3] shadow-lg flex items-center justify-center hover:bg-[#6B8C5A] active:scale-95 transition-all duration-300"
        data-testid="button-fab-woop"
        aria-label={t("tasks.fab.ariaLabel")}
      >
        <Plus className="w-7 h-7" />
      </button>

      <WoopWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onCreated={handleCreated} />
    </motion.div>
  );
}
