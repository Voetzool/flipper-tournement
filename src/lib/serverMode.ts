/** true in de Pi-versie (gebouwd met `vite build --mode server`): gegevens staan dan op de server. */
export const SERVER_MODE = import.meta.env.MODE === 'server';

/** In de Pi-versie lopen afbeeldingen via de Pi, die ze bewaart (dan ook zichtbaar zonder internet). */
export function imgUrl(u: string): string;
export function imgUrl(u: string | undefined): string | undefined;
export function imgUrl(u: string | undefined): string | undefined {
  return u && SERVER_MODE ? '/img?u=' + encodeURIComponent(u) : u;
}

/** In de Pi-versie haalt de Pi externe pagina's op (de apparaten zitten op het wifi van de Pi). */
export function remoteUrl(u: string): string {
  return SERVER_MODE ? '/api/fetch?u=' + encodeURIComponent(u) : u;
}
