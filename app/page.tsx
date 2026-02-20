"use client";

import { useEffect, useRef, useState } from "react";
import { Suspense } from "react";
import { ExternalLink, Loader2, Minus, Plus, Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { gsap } from "gsap";
import { DevModePage } from "./dev-mode";

type CatalogSuggestion = {
  id: string;
  name: string;
  unit: string;
  minPrice: number;
  source: string;
  productUrl: string | null;
};

type ResultItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minPrice: number;
  source: string;
  productUrl: string | null;
};

type UndoAction = {
  item: ResultItem;
  index: number;
};

const CURRENCY = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const searchParams = useSearchParams();

  if (searchParams.get("mode") === "dev") {
    return <DevModePage />;
  }

  return <ShopperUiPhaseFlow />;
}

function ShopperUiPhaseFlow() {
  const [cep, setCep] = useState("22470-220");
  const [cepDraft, setCepDraft] = useState("22470-220");
  const [isCepEditorOpen, setIsCepEditorOpen] = useState(false);
  const [isCepHover, setIsCepHover] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<CatalogSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [didSearch, setDidSearch] = useState(false);
  const [focused, setFocused] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const topAreaRef = useRef<HTMLDivElement | null>(null);
  const resultAreaRef = useRef<HTMLDivElement | null>(null);
  const hadItemsRef = useRef(false);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cepEditButtonRef = useRef<HTMLButtonElement | null>(null);
  const cepMetaRef = useRef<HTMLDivElement | null>(null);
  const cepInputRef = useRef<HTMLInputElement | null>(null);
  const searchPlaceholderRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const searchTerm = query.trim();
    if (!searchTerm) {
      setFilteredSuggestions([]);
      setIsSearching(false);
      setDidSearch(false);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    setDidSearch(false);

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?term=${encodeURIComponent(searchTerm)}`, {
          signal: controller.signal
        });

        if (!response.ok) {
          setFilteredSuggestions([]);
          return;
        }

        const json = (await response.json()) as { suggestions?: CatalogSuggestion[] };
        setFilteredSuggestions(Array.isArray(json.suggestions) ? json.suggestions : []);
      } catch {
        if (!controller.signal.aborted) {
          setFilteredSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
          setDidSearch(true);
        }
      }
    }, 260);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    if (filteredSuggestions.length === 0) {
      setPreviewId(null);
      return;
    }

    if (!previewId || !filteredSuggestions.some((item) => item.id === previewId)) {
      setPreviewId(filteredSuggestions[0].id);
    }
  }, [filteredSuggestions, previewId]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!searchWrapRef.current) return;
      if (!searchWrapRef.current.contains(event.target as Node)) {
        setFocused(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const hasItems = results.length > 0;
    if (hasItems && !hadItemsRef.current && topAreaRef.current && resultAreaRef.current) {
      const timeline = gsap.timeline({ defaults: { ease: "power2.out" } });
      timeline
        .fromTo(topAreaRef.current, { y: 42, opacity: 0.94 }, { y: 0, opacity: 1, duration: 0.5 })
        .fromTo(
          resultAreaRef.current,
          { y: 24, opacity: 0, scale: 0.985 },
          { y: 0, opacity: 1, scale: 1, duration: 0.45 },
          "-=0.15"
        );
    }

    hadItemsRef.current = hasItems;
  }, [results.length]);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!cepEditButtonRef.current) return;
    gsap.to(cepEditButtonRef.current, {
      opacity: isCepHover ? 1 : 0,
      x: isCepHover ? 0 : 6,
      duration: 0.2,
      ease: "power2.out"
    });
  }, [isCepHover]);

  useEffect(() => {
    if (!cepMetaRef.current) return;
    gsap.to(cepMetaRef.current, {
      x: isCepHover ? -52 : 0,
      duration: 0.2,
      ease: "power2.out"
    });
  }, [isCepHover]);

  useEffect(() => {
    if (!isCepEditorOpen || !cepInputRef.current) return;
    gsap.fromTo(cepInputRef.current, { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.18, ease: "power2.out" });
    cepInputRef.current.focus();
    cepInputRef.current.select();
  }, [isCepEditorOpen]);

  useEffect(() => {
    if (!searchPlaceholderRef.current) return;
    const shouldHidePlaceholder = focused || query.trim().length > 0;
    gsap.to(searchPlaceholderRef.current, {
      autoAlpha: shouldHidePlaceholder ? 0 : 1,
      y: shouldHidePlaceholder ? -4 : 0,
      duration: 0.22,
      ease: "power2.out"
    });
  }, [focused, query]);

  const noResultsFound = !isSearching && didSearch && filteredSuggestions.length === 0 && query.trim().length > 0;
  const showSuggestionLayer = focused && query.trim().length > 0 && (isSearching || filteredSuggestions.length > 0 || noResultsFound);

  function quantityStepByUnit(unit: string): number {
    switch (unit) {
      case "kg":
      case "l":
        return 0.5;
      case "g":
      case "ml":
        return 100;
      case "un":
      default:
        return 1;
    }
  }

  function normalizeQuantity(quantity: number, unit: string): number {
    const step = quantityStepByUnit(unit);
    const steps = Math.round(quantity / step);
    const precision = step.toString().includes(".") ? step.toString().split(".")[1].length : 0;
    return Number((steps * step).toFixed(precision));
  }

  function formatQuantity(quantity: number, unit: string): string {
    if (unit === "un") return `${Math.round(quantity)}`;
    if (unit === "g" || unit === "ml") return `${Math.round(quantity)}`;
    return `${quantity.toFixed(1).replace(/\\.0$/, "")}`;
  }

  function addItem(suggestion: CatalogSuggestion) {
    const step = quantityStepByUnit(suggestion.unit);
    setResults((current) => {
      const existing = current.find((item) => item.name === suggestion.name);
      if (existing) {
        return current.map((item) =>
          item.name === suggestion.name
            ? {
                ...item,
                quantity: normalizeQuantity(item.quantity + step, item.unit),
                minPrice: suggestion.minPrice,
                source: suggestion.source,
                productUrl: suggestion.productUrl
              }
            : item
        );
      }

      return [
        ...current,
        {
          id: `${suggestion.id}-${Date.now()}`,
          name: suggestion.name,
          quantity: step,
          unit: suggestion.unit,
          minPrice: suggestion.minPrice,
          source: suggestion.source,
          productUrl: suggestion.productUrl
        }
      ];
    });
    setQuery("");
    setFocused(false);
  }

  function queueUndo(action: UndoAction) {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
    setUndoAction(action);
    undoTimeoutRef.current = setTimeout(() => {
      setUndoAction(null);
      undoTimeoutRef.current = null;
    }, 6000);
  }

  function undoLastChange() {
    if (!undoAction) return;
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }

    setResults((current) => {
      const next = [...current];
      const safeIndex = Math.max(0, Math.min(undoAction.index, next.length));
      next.splice(safeIndex, 0, undoAction.item);
      return next;
    });
    setUndoAction(null);
  }

  function openCepEditor() {
    setCepDraft(cep);
    setIsCepEditorOpen(true);
  }

  function confirmCepChange() {
    const nextCep = cepDraft.trim();
    if (nextCep) {
      setCep(nextCep);
    }
    setIsCepEditorOpen(false);
  }

  function removeItem(id: string) {
    setResults((current) => {
      const index = current.findIndex((item) => item.id === id);
      if (index === -1) return current;
      queueUndo({ item: current[index], index });
      return current.filter((item) => item.id !== id);
    });
  }

  function incrementItemQuantity(id: string) {
    setResults((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const step = quantityStepByUnit(item.unit);
        return { ...item, quantity: normalizeQuantity(item.quantity + step, item.unit) };
      })
    );
  }

  function decrementItemQuantity(id: string) {
    setResults((current) =>
      current.flatMap((item, index) => {
        if (item.id !== id) return [item];
        const step = quantityStepByUnit(item.unit);
        const nextQuantity = normalizeQuantity(item.quantity - step, item.unit);
        if (nextQuantity <= 0) {
          queueUndo({ item, index });
          return [];
        }
        return [{ ...item, quantity: nextQuantity }];
      })
    );
  }

  const totalItems = results.reduce((sum, item) => sum + item.quantity, 0);
  const lineTotals = results.map((item) => item.quantity * item.minPrice);
  const minTotal = lineTotals.reduce((sum, price) => sum + price, 0);
  const avgUnitPrice = results.length === 0 ? 0 : results.reduce((sum, item) => sum + item.minPrice, 0) / results.length;
  const maxUnitPrice = results.length === 0 ? 0 : Math.max(...results.map((item) => item.minPrice));

  const previewItem = filteredSuggestions.find((item) => item.id === previewId) ?? filteredSuggestions[0];
  const isNoItemsState = results.length === 0;
  const isSearchActive = focused;

  return (
    <main
      className={`min-h-screen bg-white px-4 text-[#121212] ${
        isNoItemsState ? "flex items-center justify-center py-4" : "py-8"
      }`}
    >
      <section className="mx-auto w-full max-w-[540px] rounded-3xl bg-transparent">
        <div ref={topAreaRef} className="relative z-30">
          <header className="mb-[18px] flex items-end justify-between">
            <h1 className="text-[24px] font-normal leading-[24px] tracking-[-0.02em]">Shopper</h1>
            <div
              className="relative flex items-center gap-[5px] text-[14px] font-normal leading-[14px] text-[#555]"
              onMouseEnter={() => setIsCepHover(true)}
              onMouseLeave={() => setIsCepHover(false)}
            >
              <div ref={cepMetaRef} className="flex items-center gap-[5px]">
                <span>CEP:</span>
                <span className="w-[98px] text-right">{cep}</span>
              </div>
              <button
                ref={cepEditButtonRef}
                type="button"
                onClick={openCepEditor}
                className={`absolute right-0 rounded-full bg-[#404040] px-2.5 py-1 text-[11px] font-medium leading-[11px] text-white ${
                  isCepHover ? "pointer-events-auto" : "pointer-events-none"
                }`}
                style={{ opacity: 0, transform: "translateX(6px)" }}
              >
                edit
              </button>
            </div>
          </header>

          <div ref={searchWrapRef} className="relative z-40">
            <div
              className={`relative flex h-[44px] items-center gap-3 rounded-[58px] border bg-[#f9f9f9] px-[18px] ${
                isSearchActive ? "border-[#404040]" : "border-[#e2e2e2]"
              }`}
            >
              {isSearching ? (
                <Loader2 className="h-[17px] w-[17px] animate-spin text-[#404040]" />
              ) : (
                <Search className={`h-[17px] w-[17px] ${isSearchActive ? "text-[#404040]" : "text-[#7a7a7a]"}`} />
              )}
              <input
                value={query}
                onFocus={() => setFocused(true)}
                onChange={(event) => setQuery(event.target.value)}
                placeholder=""
                aria-label="Digite seu item"
                className={`h-full flex-1 bg-transparent text-[14px] font-light leading-[14px] text-[#404040] outline-none ${
                  isSearchActive ? "placeholder:text-[#404040]" : "placeholder:text-[#7a7a7a]"
                }`}
              />
              <span
                ref={searchPlaceholderRef}
                className="pointer-events-none absolute left-[47px] top-[15px] text-[14px] font-light leading-[14px] text-[#7a7a7a]"
                style={{ opacity: 1 }}
              >
                Digite seu item
              </span>
            </div>

            {showSuggestionLayer && (
              <div className="absolute left-0 right-0 top-[46px] z-50 overflow-hidden rounded-[22px] border border-[#3f3f3f] bg-white">
                <div className="max-h-[168px] overflow-y-auto">
                  {isSearching ? (
                    <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-[#6a6a6a]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Buscando itens...
                    </div>
                  ) : noResultsFound ? (
                    <div className="px-3 py-3 text-[12px] text-[#6a6a6a]">Nenhum resultado encontrado</div>
                  ) : (
                  filteredSuggestions.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center justify-between gap-3 bg-white py-2 pl-[30px] pr-3 transition-colors hover:bg-[#f9f9f9]"
                      onMouseEnter={() => setPreviewId(item.id)}
                    >
                      <button
                        type="button"
                        onClick={() => setPreviewId(item.id)}
                        className="flex-1 truncate text-left text-[14px] font-normal leading-[14px] text-[#7a7a7a] group-hover:font-semibold group-hover:text-[#404040]"
                      >
                        {item.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => addItem(item)}
                        className="rounded-full bg-transparent px-3 py-1 text-[14px] font-normal leading-[14px] text-[#7a7a7a] group-hover:bg-[#404040] group-hover:text-white"
                      >
                        Add item
                      </button>
                    </div>
                  ))
                )}
              </div>
                <div className="flex items-center justify-between border-t border-[#efefef] bg-[#fcfcfc] px-3 py-2 text-[10px] text-[#7b7b7b]">
                  <span>{isSearching ? "Buscando..." : "Buscando variações e similares..."}</span>
                  {previewItem ? <span>{CURRENCY.format(previewItem.minPrice)} / {previewItem.unit}</span> : null}
                </div>
              </div>
            )}
          </div>
        </div>

        {results.length > 0 && (
          <div ref={resultAreaRef} className="mt-[18px] space-y-[18px]">
            <section className="overflow-hidden rounded-[22px] border border-[#404040] bg-white p-[16px_16px_8px_16px]">
              <div className="flex items-center gap-3 border-b border-[#f0f0f0] py-1">
                <p className="flex-1 text-[12px] font-semibold leading-[12px] text-[#404040]">Nome do item</p>
                <p className="w-[77px] text-right text-[12px] font-semibold leading-[12px] text-[#404040]">
                  Menor preço
                </p>
                <p className="w-[69px] text-center text-[12px] font-semibold leading-[12px] text-[#404040]">
                  Quantidade
                </p>
                <p className="w-[60px] text-right text-[12px] font-semibold leading-[12px] text-[#404040]">Actions</p>
              </div>

              {results.map((item) => (
                <div key={item.id} className="group flex items-center gap-3 py-2">
                  <div className="flex flex-1 items-center gap-1.5">
                    <p className="text-[14px] font-normal leading-[14px] text-[#404040]">{item.name}</p>
                    {item.productUrl ? (
                      <a
                        href={item.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-4 w-4 items-center justify-center rounded text-[#6f6f6f] opacity-0 transition-opacity hover:text-[#404040] group-hover:opacity-100"
                        aria-label={`Abrir ${item.name} em nova aba (${item.source})`}
                        title={`Abrir no site (${item.source})`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                  <p className="w-[79px] text-right text-[12px] font-normal leading-[12px] text-[#404040]">
                    {CURRENCY.format(item.minPrice)}
                  </p>
                  <div className="flex w-[69px] items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => decrementItemQuantity(item.id)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-[#d9d9d9] text-[#555] hover:bg-[#f6f6f6]"
                      aria-label={`diminuir quantidade de ${item.name}`}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <p className="min-w-[24px] text-center text-[12px] font-normal leading-[12px] text-[#404040]">
                      {formatQuantity(item.quantity, item.unit)}
                    </p>
                    <button
                      type="button"
                      onClick={() => incrementItemQuantity(item.id)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-[#d9d9d9] text-[#555] hover:bg-[#f6f6f6]"
                      aria-label={`aumentar quantidade de ${item.name}`}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="inline-flex w-[60px] items-center justify-end gap-1 text-[12px] font-normal leading-[12px] text-[#7a7a7a]"
                  >
                    Delete <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </section>

            <section className="overflow-hidden rounded-[22px] border border-[#404040] bg-white p-[16px_16px_8px_16px]">
              <div className="mb-0 flex items-center gap-3 border-b border-[#f0f0f0] py-1">
                <span className="flex-1 text-[12px] font-semibold leading-[12px] text-[#404040]">
                  Custo da lista ({totalItems} itens)
                </span>
                <span className="w-[77px] text-right text-[12px] font-semibold leading-[12px] text-[#404040]">
                  Menor preço
                </span>
              </div>

              <div className="pt-0">
                <div className="flex items-center gap-3 py-2">
                  <span className="flex-1 text-[14px] font-semibold leading-[14px] text-[#377c1c]">Menor preço</span>
                  <span className="w-[79px] text-right text-[12px] font-semibold leading-[12px] text-[#377c1c]">
                    {CURRENCY.format(minTotal)}
                  </span>
                </div>
                <div className="flex items-center gap-3 py-2">
                  <span className="flex-1 text-[14px] font-normal leading-[14px] text-[#404040]">Preço médio</span>
                  <span className="w-[79px] text-right text-[12px] font-normal leading-[12px] text-[#404040]">
                    {CURRENCY.format(avgUnitPrice)}
                  </span>
                </div>
                <div className="flex items-center gap-3 py-2">
                  <span className="flex-1 text-[14px] font-normal leading-[14px] text-[#404040]">Maior preço</span>
                  <span className="w-[79px] text-right text-[12px] font-normal leading-[12px] text-[#404040]">
                    {CURRENCY.format(maxUnitPrice)}
                  </span>
                </div>
              </div>
            </section>
          </div>
        )}

        {results.length === 0 && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-[#8b8b8b]">
            <Plus className="h-3 w-3" />
            Comece buscando um item para montar sua lista.
          </div>
        )}
      </section>

      {undoAction && (
        <div className="fixed bottom-6 right-6 z-[90] w-[340px] rounded-[22px] border border-[#404040] bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
          <p className="text-[14px] leading-[18px] text-[#404040]">Ops, sem querer? Vamos desfazer a mudança.</p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={undoLastChange}
              className="rounded-full bg-[#404040] px-3 py-1 text-[14px] font-medium leading-[14px] text-white"
            >
              desfazer
            </button>
          </div>
        </div>
      )}

      {isCepEditorOpen && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/20 px-4">
          <div className="w-full max-w-[360px] rounded-[22px] border border-[#404040] bg-white p-4">
            <p className="text-[14px] font-medium leading-[14px] text-[#404040]">Editar CEP</p>
            <input
              ref={cepInputRef}
              value={cepDraft}
              onChange={(event) => setCepDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") confirmCepChange();
                if (event.key === "Escape") setIsCepEditorOpen(false);
              }}
              className="mt-3 h-[40px] w-full rounded-[12px] border border-[#dcdcdc] px-3 text-[14px] text-[#404040] outline-none focus:border-[#404040]"
              placeholder="Digite o CEP"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCepEditorOpen(false)}
                className="rounded-full border border-[#404040] px-3 py-1 text-[13px] text-[#404040]"
              >
                cancelar
              </button>
              <button
                type="button"
                onClick={confirmCepChange}
                className="rounded-full bg-[#404040] px-3 py-1 text-[13px] text-white"
              >
                confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
