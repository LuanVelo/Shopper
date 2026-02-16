import cron from "node-cron";
import { refreshAllCachedPrices } from "@/lib/price-engine";

declare global {
  // eslint-disable-next-line no-var
  var __schedulerStarted__: boolean | undefined;
}

export function ensureMonthlyScheduler(): void {
  if (global.__schedulerStarted__) return;

  // 03:00 no dia 5 de cada mês (America/Sao_Paulo)
  cron.schedule(
    "0 3 5 * *",
    async () => {
      await refreshAllCachedPrices();
    },
    {
      timezone: "America/Sao_Paulo"
    }
  );

  global.__schedulerStarted__ = true;
}
