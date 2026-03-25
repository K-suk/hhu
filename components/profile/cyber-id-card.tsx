import type { Database } from "@/lib/supabase/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type CyberIdProfile = Pick<
  ProfileRow,
  "display_name" | "department" | "avatar_url"
> &
  Partial<Pick<ProfileRow, "gender_identity" | "gpa">>;

type CyberIdCardProps = {
  profile: CyberIdProfile;
};

export function CyberIdCard({ profile }: CyberIdCardProps) {
  const avatarUrl = profile.avatar_url;
  const displayName = profile.display_name ?? "UNREGISTERED";
  const department = profile.department ?? "UNDECLARED";
  const gender = profile.gender_identity ?? "--";
  const gpa = profile.gpa;

  return (
    <div className="relative mb-4 aspect-[1.586/1] w-full">
      <div className="absolute inset-0 overflow-hidden rounded-2xl border-2 border-[#ffbf00]/50 bg-[#1a1614] bg-[radial-gradient(circle_at_85%_90%,rgba(199,140,56,0.25)_0%,rgba(199,140,56,0.08)_40%,transparent_70%),linear-gradient(120deg,rgba(255,191,0,0.05)_0%,rgba(255,191,0,0.18)_50%,rgba(255,191,0,0.03)_100%)] shadow-[0_0_10px_rgba(255,191,0,0.3),inset_0_0_20px_rgba(255,191,0,0.1)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,191,0,0.12)_45%,rgba(255,191,0,0.22)_50%,rgba(255,191,0,0.12)_55%,transparent_75%)] bg-[length:220%_100%] animate-[shimmer_4s_linear_infinite]" />
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_1px,rgba(255,191,0,0.08)_2px,rgba(255,191,0,0.08)_3px)] opacity-40" />

        <div className="relative z-10 flex h-full flex-col justify-between p-3.5">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="mb-0.5 font-mono text-[10px] tracking-widest text-[#ffbf00]/80">
                HHU
              </span>
              <h3 className="text-lg leading-none font-bold text-white">STUDENT ID</h3>
            </div>
            <div className="flex size-8 items-center justify-center rounded border border-[#ffbf00]/30 bg-black/40">
              <span className="material-symbols-outlined text-lg text-[#ffbf00]">badge</span>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-4">
            <div className="relative size-16 shrink-0 overflow-hidden rounded border border-emerald-300/70 bg-black/60 shadow-[0_0_10px_rgba(52,211,153,0.5)]">
              <div className="absolute inset-0 z-10 bg-[repeating-linear-gradient(0deg,transparent,transparent_1px,rgba(255,191,0,0.1)_2px,rgba(255,191,0,0.1)_3px)] opacity-60" />
              {avatarUrl ? (
                <>
                  <img
                    src={avatarUrl}
                    alt="Student avatar"
                    className="h-full w-full object-cover avatar-grain [image-rendering:pixelated]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(130deg,rgba(255,255,255,0.06)_0%,rgba(0,255,255,0.12)_40%,rgba(255,0,238,0.1)_70%,rgba(255,255,255,0.04)_100%)] mix-blend-screen" />
                </>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center text-[#ffbf00]/50">
                  <span className="material-symbols-outlined mb-1 text-2xl">face</span>
                  <span className="font-mono text-center text-[8px] leading-tight">
                    PROFILE
                    <br />
                    IMAGE
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2 font-mono">
              <div>
                <p className="mb-0.5 text-[8px] tracking-wider text-[#ffbf00]/60 uppercase">Name</p>
                <p className="truncate text-sm font-medium tracking-wide text-white uppercase">{displayName}</p>
              </div>
              <div>
                <p className="mb-0.5 text-[8px] tracking-wider text-[#ffbf00]/60 uppercase">Department</p>
                <p className="truncate text-xs text-gray-300 uppercase">{department}</p>
              </div>
            </div>
          </div>

          <div className="mt-auto flex items-end justify-between border-t border-white/5 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col">
                <span className="mb-0.5 text-[8px] text-[#ffbf00]/60 uppercase">Identity</span>
                <span className="font-mono text-xs tracking-widest text-white">{gender}</span>
              </div>
              <div className="flex flex-col">
                <span className="mb-0.5 text-[8px] text-[#ffbf00]/60 uppercase">Current GPA</span>
                <span className="font-mono text-xs tracking-widest text-amber-300">
                  {typeof gpa === "number" ? gpa.toFixed(2) : "--"}
                </span>
              </div>
            </div>
            <div className="h-6 w-24 bg-white/20 [mask-image:repeating-linear-gradient(90deg,black,black_2px,transparent_2px,transparent_4px,black_4px,black_5px,transparent_5px,transparent_7px)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
