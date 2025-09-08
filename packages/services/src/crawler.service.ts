import { inject, injectable } from "inversify";

import { AgenticConfig, agenticConfigSymbol } from "./config";
import { apiWithRetry } from "./utils/axios";

interface Filter {
  segment: string;
  isFirst: boolean;
  level: number;
}

interface SitemapFilters {
  sitemaps?: Filter[];
  links?: Omit<Filter, "level">[];
}

@injectable()
export class CrawlerService {
  constructor(
    @inject(agenticConfigSymbol) private readonly appConfig: AgenticConfig,
  ) {}

  async sitemapLinks(params: {
    domain: string;
    filters: SitemapFilters[];
    from?: Date;
    to?: Date;
  }) {
    const { domain, filters, from, to } = params;
    const links = await this.sitemapLinksViaOctopus({
      domain,
      filters,
      from,
      to,
    });
    return links;
  }

  async sitemapLinksViaOctopus(params: {
    domain: string;
    filters: SitemapFilters[];
    from?: Date;
    to?: Date;
  }) {
    const { domain, filters, from, to } = params;
    const links = await apiWithRetry.post<string[]>(
      `${this.appConfig.octopusUrl}/api/sitemaps/links`,
      {
        domain,
        filters,
        from,
        to,
      },
    );
    return links.data;
  }
}
