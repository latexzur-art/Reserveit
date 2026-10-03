"use client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface EquipmentTypePickerProps {
  id?: string;
  labelledBy: string;
  value: string;
  onValueChange: (value: string) => void;
  equipmentTypes: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder?: string;
}

export function EquipmentTypePicker({
  id,
  labelledBy,
  value,
  onValueChange,
  equipmentTypes,
  open,
  onOpenChange,
  placeholder = "Select type...",
}: EquipmentTypePickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-labelledby={labelledBy}
          className="w-full rounded-2xl font-bold h-12 text-xs justify-between px-4 border-input"
        >
          {value
            ? equipmentTypes.find((t) => String(t.id) === value)?.name
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 rounded-xl border-none shadow-2xl">
        <Command>
          <CommandInput placeholder="Search type..." className="h-10 text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs p-2">No type found.</CommandEmpty>
            <CommandGroup>
              {equipmentTypes?.map((t: any) => (
                <CommandItem
                  key={t.id}
                  value={String(t.id)}
                  onSelect={() => {
                    onValueChange(String(t.id));
                    onOpenChange(false);
                  }}
                  className="text-xs font-medium"
                >
                  <Check className={cn("mr-2 h-4 w-4", value === String(t.id) ? "opacity-100" : "opacity-0")} />
                  {t.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
