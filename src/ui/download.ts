export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const gbp = (x: number | null | undefined) =>
  x === null || x === undefined ? 'n/a' : `£${x.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
export const mwh = (x: number | null | undefined, dp = 2) => (x === null || x === undefined ? 'n/a' : `${x.toFixed(dp)} MWh`);
export const signedGbp = (x: number) => `${x < 0 ? '-' : '+'}${gbp(Math.abs(x))}`;
