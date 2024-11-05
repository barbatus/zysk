import { asClass, type Constructor, createContainer } from "awilix";
import { camelCase } from "lodash";

import { MetricsService } from "./metrics.service";
import { PortfolioService } from "./portfolio.service";

export const container = createContainer();

const services = [MetricsService, PortfolioService] as Constructor<
  MetricsService | PortfolioService
>[];

services.forEach((service) => {
  container.register({
    [camelCase(service.name)]: asClass(service),
  });
});

export function resolve<T extends (typeof services)[number]>(
  service: T,
): InstanceType<T> {
  return container.resolve<InstanceType<T>>(camelCase(service.name));
}
