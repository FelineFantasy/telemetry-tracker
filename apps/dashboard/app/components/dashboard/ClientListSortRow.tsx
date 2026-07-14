"use client";

import { useEffect, useId, useState } from "react";
import { DashboardCustomSelect, type DashboardSelectOption } from "@/app/components/dashboard/DashboardCustomSelect";
import {
  FilterField,
  FilterLabel,
  FilterRow,
  FilterSegment,
  FilterSegmentItem,
  FilterSubmitBtn,
  FilterSubmitWrap,
} from "@/app/components/dashboard/list-filters-ui";

type Props = {
  sort: string;
  order: string;
  sortOptions: DashboardSelectOption[];
  onApply: (sort: string, order: string) => void;
  isLoading?: boolean;
};

export function ClientListSortRow({
  sort,
  order,
  sortOptions,
  onApply,
  isLoading = false,
}: Props) {
  const fieldIds = useId();
  const [draftSort, setDraftSort] = useState(sort);
  const [draftOrder, setDraftOrder] = useState(order);

  useEffect(() => {
    setDraftSort(sort);
    setDraftOrder(order);
  }, [sort, order]);

  const id = (suffix: string) => `${fieldIds.replace(/:/g, "")}-${suffix}`;

  return (
    <FilterRow>
      <FilterField>
        <FilterLabel id={id("sort-l")}>Sort by</FilterLabel>
        <DashboardCustomSelect
          value={draftSort}
          options={sortOptions}
          triggerId={id("sort-t")}
          listLabelledBy={id("sort-l")}
          onValueChange={setDraftSort}
        />
      </FilterField>

      <FilterSegment
        legend="Order"
        title="Descending vs ascending order for the selected column."
        ariaLabel="Sort order"
      >
        <FilterSegmentItem
          name={`${id("order")}-group`}
          value="desc"
          checked={draftOrder !== "asc"}
          onChange={() => setDraftOrder("desc")}
        >
          Desc
        </FilterSegmentItem>
        <FilterSegmentItem
          name={`${id("order")}-group`}
          value="asc"
          checked={draftOrder === "asc"}
          onChange={() => setDraftOrder("asc")}
        >
          Asc
        </FilterSegmentItem>
      </FilterSegment>

      <FilterSubmitWrap>
        <FilterSubmitBtn
          type="button"
          disabled={isLoading}
          onClick={() => onApply(draftSort, draftOrder)}
        >
          Apply sort
        </FilterSubmitBtn>
      </FilterSubmitWrap>
    </FilterRow>
  );
}
