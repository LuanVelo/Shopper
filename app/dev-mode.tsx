"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Plus, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DEFAULT_CEP, SOURCE_CATEGORIES } from "@/lib/categories";
import { normalizeItemName } from "@/lib/normalization";
import { brl } from "@/lib/utils";
import { CalculationResponse } from "@/types";

type ItemDraft = {
  id: string;
  name: string;
  quantity: number;
};

type DevStatusResponse = {
  itemsCount: number;
  itemsByCategory: Array<{ category: string; count: number }>;
  priceErrorPercent: number;
  totals: {
    termsCount: number;
    snapshotsCount: number;
    offersCount: number;
  };
  cacheUpdatedAt?: string | null;
};

const INITIAL_ITEM_ID = "item-1";
let itemSequence = 2;

function nextItemId(): string {
  const id = `item-${itemSequence}`;
  itemSequence += 1;
  return id;
}

export function DevModePage() {
  const [cep, setCep] = useState(DEFAULT_CEP);
  const [items, setItems] = useState<ItemDraft[]>([{ id: INITIAL_ITEM_ID, name: "", quantity: 1 }]);
  const [data, setData] = useState<CalculationResponse | null>(null);
  const [devStatus, setDevStatus] = useState<DevStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<string>("Rotina automática: todo dia 5 às 03:00");

  const hasValidItems = useMemo(() => items.some((item) => item.name.trim() && item.quantity > 0), [items]);
  const ruleMap = useMemo(() => {
    const map = new Map<string, { min: number; step: number }>();
    for (const item of data?.items ?? []) {
      map.set(normalizeItemName(item.itemName), {
        min: item.quantityRule.min,
        step: item.quantityRule.step
      });
    }
    return map;
  }, [data]);
  const checkoutItems = useMemo(() => {
    const priceByName = new Map<string, CalculationResponse["items"][number]>();
    for (const item of data?.items ?? []) {
      priceByName.set(normalizeItemName(item.itemName), item);
    }

    return items
      .filter((item) => item.name.trim() && item.quantity > 0)
      .map((item) => {
        const normalizedName = normalizeItemName(item.name);
        const pricedItem = priceByName.get(normalizedName);
        return {
          id: item.id,
          name: item.name.trim(),
          lowestTotalPrice: pricedItem?.lowestTotalPrice ?? null
        };
      });
  }, [data, items]);

  useEffect(() => {
    void refreshDevStatus();
  }, []);

  useEffect(() => {
    if (!hasValidItems) {
      setData(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cep, items })
        });
        const json = (await response.json()) as CalculationResponse;
        setData(json);
        void refreshDevStatus();
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => clearTimeout(timeout);
  }, [cep, items, hasValidItems]);

  function updateItem(id: string, patch: Partial<ItemDraft>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function getRuleByName(name: string) {
    const normalized = normalizeItemName(name);
    return ruleMap.get(normalized) ?? null;
  }

  function snapQuantity(quantity: number, rule: { min: number; step: number }) {
    const safeQty = Number.isFinite(quantity) && quantity > 0 ? quantity : rule.min;
    if (safeQty <= rule.min) return rule.min;
    const steps = Math.round((safeQty - rule.min) / rule.step);
    const snapped = rule.min + steps * rule.step;
    const precision = Math.max(
      rule.min.toString().includes(".") ? rule.min.toString().split(".")[1].length : 0,
      rule.step.toString().includes(".") ? rule.step.toString().split(".")[1].length : 0
    );
    return Number(snapped.toFixed(precision));
  }

  function addItem() {
    setItems((current) => [...current, { id: nextItemId(), name: "", quantity: 1 }]);
  }

  function removeItem(id: string) {
    setItems((current) => (current.length === 1 ? current : current.filter((item) => item.id !== id)));
  }

  async function refreshDevStatus() {
    try {
      const response = await fetch("/api/dev-status");
      const json = (await response.json()) as DevStatusResponse;
      setDevStatus(json);
    } catch {
      setDevStatus(null);
    }
  }

  async function triggerManualUpdate() {
    setUpdating(true);
    setUpdateInfo("Atualizando fontes... estimativa de até 30s para listas já pesquisadas.");
    try {
      const response = await fetch("/api/update-prices", { method: "POST" });
      const json = await response.json();
      setUpdateInfo(
        `Atualizado em ${new Date(json.updatedAt).toLocaleString("pt-BR")}. Itens recarregados: ${json.updated}. Tempo: ${json.elapsedSeconds}s.`
      );
      void refreshDevStatus();
    } catch {
      setUpdateInfo("Falha ao atualizar manualmente. Tente novamente.");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-6 px-4 py-8 md:px-8">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Shopper v0 · Lista Inteligente de Supermercado</CardTitle>
          <p className="text-sm text-muted-foreground">
            Fontes: Prezunic, Zona Sul, Extra e Supermarket Delivery. Exibindo menor preço e média simples por item e
            para a lista.
          </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:max-w-xs">
                <label className="text-sm font-medium">CEP da pesquisa</label>
                <Input value={cep} onChange={(event) => setCep(event.target.value)} placeholder="22470-220" />
              </div>

              <div className="space-y-3">
                {items.map((item) => {
                  const rule = getRuleByName(item.name);
                  return (
                    <div key={item.id} className="grid gap-2 md:grid-cols-[1fr_200px_52px]">
                      <Input
                        placeholder="Ex.: arroz, leite, banana"
                        value={item.name}
                        onChange={(event) => updateItem(item.id, { name: event.target.value })}
                      />
                      <Input
                        type="number"
                        min={rule?.min ?? 0.01}
                        step={rule?.step ?? 0.01}
                        placeholder="Quantidade"
                        value={item.quantity}
                        onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) || 0 })}
                        onBlur={() => {
                          if (!rule) return;
                          updateItem(item.id, { quantity: snapQuantity(item.quantity, rule) });
                        }}
                      />
                      <Button variant="outline" onClick={() => removeItem(item.id)} aria-label="remover item">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={addItem}>
                    <Plus className="mr-2 h-4 w-4" /> Adicionar item
                  </Button>
                  <Button variant="outline" onClick={triggerManualUpdate} disabled={updating}>
                    {updating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Atualizar preços manualmente
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{updateInfo}</p>
                <p className="text-xs text-muted-foreground">
                  A unidade é definida automaticamente pelo padrão encontrado nas ofertas dos mercados (ex.: carne em
                  kg, leite em L). Informe a quantidade nessa mesma unidade.
                </p>
                <p className="text-xs text-muted-foreground">
                  A quantidade segue passos permitidos por item (ex.: 1 em 1, 500g em 500g), conforme as embalagens
                  encontradas nos sites.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resultado em tempo real</CardTitle>
            </CardHeader>
            <CardContent>
              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Recalculando...
                </div>
              )}

              {!loading && !data && <p className="text-sm text-muted-foreground">Adicione itens para calcular.</p>}

              {!loading && data && (
                <div className="space-y-4">
                  <div className="overflow-auto rounded-md border">
                    <table className="w-full min-w-[780px] text-sm">
                      <thead className="bg-muted/70 text-left">
                        <tr>
                          <th className="p-3">Item</th>
                          <th className="p-3">Qtd</th>
                          <th className="p-3">Melhor fonte</th>
                          <th className="p-3">Menor preço unitário</th>
                          <th className="p-3">Preço médio unitário</th>
                          <th className="p-3">Total menor</th>
                          <th className="p-3">Total médio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.items.map((item) => (
                          <tr key={`${item.itemName}-${item.unit}`} className="border-t">
                            <td className="p-3 font-medium">
                              <div className="flex items-center gap-2">
                                <span>{item.itemName}</span>
                                {item.bestOfferUrl ? (
                                  <a
                                    href={item.bestOfferUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium hover:bg-muted"
                                    title={item.bestOfferTitle ?? `Abrir oferta de ${item.itemName}`}
                                  >
                                    Ver oferta <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {item.hasRealOffers ? "Sem link" : "Sem oferta real"}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="p-3">{item.bestSource ?? "-"}</td>
                            <td className="p-3">
                              {brl(item.lowestUnitPrice)} / {item.unit}
                            </td>
                            <td className="p-3">
                              {brl(item.averageUnitPrice)} / {item.unit}
                            </td>
                            <td className="p-3">{brl(item.lowestTotalPrice)}</td>
                            <td className="p-3">{brl(item.averageTotalPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <Summary label="Quantidade de itens" value={String(data.summary.itemsCount)} />
                    <Summary label="Menor total da lista" value={brl(data.summary.lowestTotalListPrice)} />
                    <Summary label="Total médio esperado" value={brl(data.summary.averageTotalListPrice)} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Categorias por fonte</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {Object.entries(SOURCE_CATEGORIES).map(([source, categories]) => (
                <div key={source} className="rounded-lg border bg-background p-3">
                  <h4 className="mb-2 text-sm font-semibold capitalize">{source}</h4>
                  <p className="text-xs text-muted-foreground">{categories.join(" · ")}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dev Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!devStatus ? (
                <p className="text-sm text-muted-foreground">Carregando status...</p>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Summary label="Número de itens" value={String(devStatus.itemsCount)} />
                    <Summary label="Termos catalogados" value={String(devStatus.totals.termsCount)} />
                    <Summary label="% com erro de preço" value={`${devStatus.priceErrorPercent.toFixed(2)}%`} />
                  </div>

                  <div className="rounded-lg border bg-background p-4">
                    <p className="text-sm font-medium">Itens em cada categoria</p>
                    {devStatus.itemsByCategory.length === 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">Sem dados no cache ainda.</p>
                    ) : (
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        {devStatus.itemsByCategory.map((entry) => (
                          <div key={entry.category} className="flex items-center justify-between text-sm">
                            <span>{entry.category}</span>
                            <span className="font-medium">{entry.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="xl:sticky xl:top-8">
          <CardHeader>
            <CardTitle>Resumo do checkout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {checkoutItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Adicione itens para montar seu checkout.</p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  {checkoutItems.map((item) => (
                    <div key={item.id} className="rounded-lg border bg-background p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{item.name}</p>
                        {item.lowestTotalPrice === null ? (
                          <p className="text-xs text-muted-foreground">Aguardando preço</p>
                        ) : (
                          <p className="text-sm font-semibold">{brl(item.lowestTotalPrice)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Menor preço total</p>
                  <p className="mt-1 text-lg font-semibold">{brl(data?.summary.lowestTotalListPrice ?? 0)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Valor médio dos itens: {brl(data?.summary.averageTotalListPrice ?? 0)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
