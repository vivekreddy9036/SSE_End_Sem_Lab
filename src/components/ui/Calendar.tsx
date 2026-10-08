"use client";

import * as React from "react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import "react-day-picker/style.css";

export type CalendarProps = DayPickerProps;

export function Calendar({ className, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={`rounded-lg border ${className ?? ""}`}
      {...props}
    />
  );
}

// Basic calendar demo
export function CalendarBasic() {
  const [date, setDate] = React.useState<Date | undefined>(new Date());

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      captionLayout="dropdown"
      className="rounded-lg border [--cell-size:2.75rem] md:[--cell-size:3rem]"
    />
  );
}
