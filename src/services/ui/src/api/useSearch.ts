import {
  aggQueryBuilder,
  filterQueryBuilder,
  paginationQueryBuilder,
  sortQueryBuilder,
} from "@/components/Opensearch/utils";
import { useMutation, UseMutationOptions } from "@tanstack/react-query";
import { API } from "aws-amplify";
import type {
  OsQueryState,
  ReactQueryApiError,
  OsFilterable,
  OsAggQuery,
  OsMainSearchResponse,
  OsMainSourceItem,
} from "shared-types";

type QueryProps = {
  filters: OsQueryState["filters"];
  sort?: OsQueryState["sort"];
  pagination: OsQueryState["pagination"];
  aggs?: OsAggQuery[];
};

export const getSearchData = async (
  props: QueryProps
): Promise<OsMainSearchResponse> => {
  const searchData = await API.post("os", "/search/main", {
    body: {
      ...filterQueryBuilder(props.filters),
      ...paginationQueryBuilder(props.pagination),
      ...(!!props.sort && sortQueryBuilder(props.sort)),
      ...(!!props.aggs && aggQueryBuilder(props.aggs)),
      track_total_hits: true,
    },
  });

  return searchData;
};

export const getAllSearchData = async (filters?: OsFilterable[]) => {
  if (!filters) return [];

  const recursiveSearch = async (
    startPage: number
  ): Promise<OsMainSourceItem[]> => {
    if (startPage * 1000 >= 10000) {
      return [];
    }

    const searchData = await API.post("os", "/search/main", {
      body: {
        ...filterQueryBuilder(filters),
        ...paginationQueryBuilder({ number: startPage, size: 1000 }),
      },
    });

    if (searchData?.hits.hits.length < 1000) {
      return searchData.hits.hits.map((hit: any) => ({ ...hit._source })) || [];
    }

    return searchData.hits.hits
      .map((hit: any) => ({
        ...hit._source,
      }))
      .concat(await recursiveSearch(startPage + 1));
  };

  return await recursiveSearch(0);
};

export const useOsSearch = (
  options?: UseMutationOptions<
    OsMainSearchResponse,
    ReactQueryApiError,
    QueryProps
  >
) => {
  return useMutation<OsMainSearchResponse, ReactQueryApiError, QueryProps>(
    (props) => getSearchData(props),
    options
  );
};
