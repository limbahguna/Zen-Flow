import { useQuery } from "@tanstack/react-query";
import { fetchLessons } from "@/lib/lessons";
import { useLanguage } from "@/context/LanguageContext";

export function useLessons() {
  const { language } = useLanguage();
  return useQuery({
    queryKey: ["micro_lessons", language],
    queryFn: () => fetchLessons(language),
  });
}
