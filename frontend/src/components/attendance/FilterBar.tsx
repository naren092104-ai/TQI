import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const FilterBar: React.FC<{ onReset?: () => void }> = ({ onReset }) => {
  return (
    <div className="flex flex-wrap gap-3 items-end py-3 bg-background z-10 border-b border-border/50 px-4">
      <Select>
        <SelectTrigger className="w-40"><SelectValue placeholder="Panchayat" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="p1">Panchayat 1</SelectItem>
        </SelectContent>
      </Select>
      <Select>
        <SelectTrigger className="w-40"><SelectValue placeholder="Village" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="v1">Village 1</SelectItem>
        </SelectContent>
      </Select>
      <Select>
        <SelectTrigger className="w-40"><SelectValue placeholder="School" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="s1">School 1</SelectItem>
        </SelectContent>
      </Select>
      <Input placeholder="Student search" className="min-w-[220px]" />
      <div className="ml-auto flex gap-2">
        <Button variant="outline" onClick={onReset}>Reset</Button>
        <Button>Filter</Button>
      </div>
    </div>
  );
};

export default FilterBar;
