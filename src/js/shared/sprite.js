
import spriteUrl from '../../img/sprite.svg?url';

export const SPRITE = spriteUrl;

export const icon = (id, cls = 'ico') =>
  `<svg class="${cls}" aria-hidden="true"><use href="${SPRITE}#${id}"></use></svg>`;
