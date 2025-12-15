import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function TagInput({ label, name, value = [], onChange, placeholder }) {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    if (inputValue.trim() && !value.includes(inputValue.trim())) {
      onChange(name, [...value, inputValue.trim()]);
      setInputValue('');
    }
  };

  const handleRemove = (tag) => {
    onChange(name, value.filter(t => t !== tag));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 h-10 border-slate-200"
        />
        <Button
          type="button"
          onClick={handleAdd}
          variant="outline"
          size="icon"
          className="h-10 w-10 border-slate-200 hover:bg-[#1e3a5f] hover:text-white"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {value.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="bg-[#1e3a5f]/10 text-[#1e3a5f] hover:bg-[#1e3a5f]/20 pr-1"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemove(tag)}
                className="ml-1 hover:bg-[#1e3a5f]/20 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}