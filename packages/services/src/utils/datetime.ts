import {
  isMonday,
  startOfDay,
  startOfWeek as startOfWeek_,
  subDays,
  addDays,
} from "date-fns";

export const getPrevDay = (currentDate: Date) => {
  const prevDate = subDays(currentDate, isMonday(currentDate) ? 2 : 1);
  return startOfDay(prevDate);
};

export const getNextDay = (currentDate: Date) => {
  const nextDate = addDays(currentDate, 1);
  return startOfDay(nextDate);
};

export const startOfWeek = (date: Date) => {
  return startOfWeek_(date, { weekStartsOn: 1 });
};
