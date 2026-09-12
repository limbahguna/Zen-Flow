import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reportToken?: string;
}

interface CoachContextType {
  messages: CoachMessage[];
  setMessages: React.Dispatch<React.SetStateAction<CoachMessage[]>>;
}

const CoachContext = createContext<CoachContextType | undefined>(undefined);

export function CoachProvider({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string | null;
}) {
  const [state, setState] = useState<{
    ownerId: string | null;
    messages: CoachMessage[];
  }>({ ownerId: userId, messages: [] });

  const messages = state.ownerId === userId ? state.messages : [];
  const setMessages = useCallback<CoachContextType["setMessages"]>(
    (update) => {
      setState((previous) => {
        const current = previous.ownerId === userId ? previous.messages : [];
        const next =
          typeof update === "function" ? update(current) : update;
        return { ownerId: userId, messages: next };
      });
    },
    [userId],
  );

  useEffect(() => {
    setState({ ownerId: userId, messages: [] });
  }, [userId]);

  return (
    <CoachContext.Provider value={{ messages, setMessages }}>
      {children}
    </CoachContext.Provider>
  );
}

export function useCoachContext(): CoachContextType {
  const ctx = useContext(CoachContext);
  if (!ctx) throw new Error("useCoachContext must be used within CoachProvider");
  return ctx;
}
