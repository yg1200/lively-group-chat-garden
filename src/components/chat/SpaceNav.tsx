import { useState } from "react";
import { Plus, Settings } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SpaceAvatar } from "./Avatar";
import { ACTIVE_GROUP_KEY, errorText, type Group } from "@/lib/chat";

/** Left-hand list of spaces, styled like Google Chat's navigation. */
export function SpaceNav({ groups, currentId, isAdmin, pendingCount, onSwitch, onCreate, onOpenAdmin }: {
  groups: Group[];
  currentId: string;
  isAdmin: boolean;
  pendingCount: number;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onOpenAdmin: () => void;
}) {
  return (
    <nav aria-label="מרחבים" className="flex h-full min-h-0 flex-col gap-0.5 py-1">
      <button
        onClick={onCreate}
        className="mb-2.5 flex h-14 flex-none items-center gap-2 self-start rounded-[18px] bg-nav-sel px-6 text-[15px] font-medium text-accent-foreground hover:brightness-95"
      >
        <Plus className="size-[22px]" />
        <span>צור מרחב</span>
      </button>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {groups.map((g) => (
          <button
            key={g.id}
            onClick={() => onSwitch(g.id)}
            aria-current={g.id === currentId}
            className={cn(
              "flex h-9 w-full items-center gap-3 rounded-full px-3.5 text-start text-sm hover:bg-field",
              g.id === currentId && "bg-nav-sel font-medium text-accent-foreground hover:bg-nav-sel",
            )}
          >
            <SpaceAvatar name={g.name} size={24} />
            <span className="min-w-0 flex-1 truncate">{g.name}</span>
          </button>
        ))}
      </div>
      {isAdmin && (
        <div className="sticky bottom-0 mt-auto flex-none border-t bg-background pb-1 pt-2">
          <button onClick={onOpenAdmin} className="flex h-9 w-full items-center gap-3 rounded-full px-3.5 text-start text-sm hover:bg-field">
            <span className="flex size-6 flex-none items-center justify-center text-muted-foreground"><Settings className="size-5" /></span>
            <span className="min-w-0 flex-1">הגדרות</span>
            {pendingCount > 0 && (
              <span aria-label={`${pendingCount} פריטים ממתינים`} className="min-w-[18px] rounded-full bg-destructive px-1.5 text-center text-[11px] font-bold text-destructive-foreground">{pendingCount}</span>
            )}
          </button>
        </div>
      )}
    </nav>
  );
}

/** Creates a new space; the creator becomes its admin (server-side `create_group`). */
export function CreateSpaceDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_group", { _name: name.trim(), _description: desc.trim() });
    setBusy(false);
    if (error) return void toast.error(errorText(error));
    try {
      localStorage.setItem(ACTIVE_GROUP_KEY, data);
    } catch {
      /* ignore: the new space just won't be preselected */
    }
    setName("");
    setDesc("");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>יצירת מרחב</DialogTitle></DialogHeader>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם המרחב" autoFocus />
        <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="תיאור (לא חובה)" />
        <DialogFooter>
          <Button className="rounded-full" onClick={create} disabled={!name.trim() || busy}>יצירה</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
