import {
  addMinutes,
  endOfWeek,
  isMonday,
  startOfWeek as startOfWeek_,
  subDays,
} from "date-fns";

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

  const endOfWeekDate = endOfWeek(currentDate);
  return addMinutes(endOfWeekDate, 1);
};
