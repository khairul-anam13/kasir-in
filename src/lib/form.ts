/** Hasil server action untuk <ActionForm>. */
export type FormState = { error?: string; ok?: string } | undefined;

/** Pembaca FormData yang dipakai semua server action. */
export const str = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);
export const int = (fd: FormData, k: string, d = 0) => {
  const raw = String(fd.get(k) ?? "");
  const n = Number(raw.replace(/[.\s]/g, "").replace(",", "."));
  return raw !== "" && Number.isFinite(n) ? Math.trunc(n) : d;
};
export const num = (fd: FormData, k: string, d = 0) => {
  const raw = String(fd.get(k) ?? "").trim();
  const n = Number(raw.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return raw !== "" && Number.isFinite(n) ? n : d;
};
export const optInt = (fd: FormData, k: string) => (str(fd, k) === "" ? null : int(fd, k));
export const flag = (fd: FormData, k: string) => fd.get(k) === "on";
export const fail = (error: string): FormState => ({ error });
export const isUnique = (e: unknown) => (e as { code?: string })?.code === "23505";
