import { isMonday, startOfWeek as startOfWeek_, addMinutes, endOfWeek, subDays } from "date-fns";

export const startOfWeek = (date: Date) => {
  return startOfWeek_(date, { weekStartsOn: 1 });
};

export const getPrevWeekDate = (currentDate: Date) => {
  return startOfWeek(subDays(currentDate, 7));
};

export const getUpcomingWeekDate = (currentDate: Date) => {
  if (isMonday(currentDate)) {
    return startOfWeek(currentDate);
  }

  return addMinutes(endOfWeek(currentDate), 1);
};
