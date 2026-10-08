"use client";

import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/Calendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: string;               // "YYYY-MM-DD" string (form-compatible)
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  disableFutureDates?: boolean;
}

export function DatePicker({
  value,
  onChange,
  label,
  required,
  placeholder = "Select date",
  className = "",
  id,
  disableFutureDates = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = value
    ? parse(value, "yyyy-MM-dd", new Date())
    : undefined;

  const validDate =
    selectedDate && isValid(selectedDate) ? selectedDate : undefined;

  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <Label htmlFor={inputId}>
          {label}
          {required && " *"}
        </Label>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={inputId}
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !validDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {validDate ? format(validDate, "dd MMM yyyy") : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={validDate}
            defaultMonth={validDate ?? new Date()}
            captionLayout="dropdown"
            disabled={disableFutureDates ? { after: new Date() } : undefined}
            onSelect={(date) => {
              onChange(date ? format(date, "yyyy-MM-dd") : "");
              setOpen(false);
            }}
            className="[--cell-size:2.75rem]"
          />
          {value && (
            <div className="px-3 pb-2">
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className="text-xs text-destructive hover:text-destructive/80 cursor-pointer"
              >
                Clear date
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Hidden native input for form validation */}
      {required && (
        <input
          type="text"
          required
          value={value}
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
