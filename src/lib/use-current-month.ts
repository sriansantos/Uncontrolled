"use client";

import { useEffect, useState } from "react";
import { currentYearMonth } from "./month";

// O Next 16 bloqueia o pré-render de client components que leem a data/hora
// atual no primeiro render. Este hook resolve o mês no cliente após a
// montagem: começa vazio (estado de carregamento) e é preenchido no effect.
// Uso como useState: const [month, setMonth] = useCurrentMonth();
export function useCurrentMonth(): [string, (m: string) => void] {
  const [month, setMonth] = useState("");
  useEffect(() => {
    setMonth((m) => m || currentYearMonth());
  }, []);
  return [month, setMonth];
}
