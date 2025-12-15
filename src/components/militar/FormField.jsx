import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function FormField({ 
  label, 
  name, 
  value, 
  onChange, 
  type = "text", 
  options = [], 
  placeholder,
  required = false,
  className = ""
}) {
  const handleChange = (e) => {
    onChange(name, e.target.value);
  };

  const handleSelectChange = (val) => {
    onChange(name, val);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label htmlFor={name} className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {type === "select" ? (
        <Select value={value || ""} onValueChange={handleSelectChange}>
          <SelectTrigger className="h-10 border-slate-200 focus:border-[#1e3a5f] focus:ring-[#1e3a5f]/20">
            <SelectValue placeholder={placeholder || `Selecione ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={name}
          name={name}
          type={type}
          value={value || ""}
          onChange={handleChange}
          placeholder={placeholder}
          className="h-10 border-slate-200 focus:border-[#1e3a5f] focus:ring-[#1e3a5f]/20"
        />
      )}
    </div>
  );
}