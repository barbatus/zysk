import {
  addMinutes,
  endOfWeek,
  isMonday,
  startOfWeek as startOfWeek_,
  subDays,
} from "date-fns";

export const toUtcDate = (date: Date) => {
  return new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
    ),
  );
};

export const startOfWeek = (date: Date) => {
  return startOfWeek_(date, { weekStartsOn: 1 });
};

export const getPrevWeekDate = (currentDate: Date) => {
  return toUtcDate(startOfWeek(subDays(currentDate, 7)));
};

export const getUpcomingWeekDate = (currentDate: Date) => {
  if (isMonday(currentDate)) {
    return toUtcDate(startOfWeek(currentDate));
  }

  const endOfWeekDate = endOfWeek(currentDate);
  const finalDate = addMinutes(endOfWeekDate, 1);
  return toUtcDate(finalDate);
};
