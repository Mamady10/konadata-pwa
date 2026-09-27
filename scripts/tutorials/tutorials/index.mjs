import { BTP_TUTORIALS } from './btp.mjs';
import { COMMON_TUTORIALS } from './commun.mjs';
import { ECOLE_TUTORIALS } from './ecole.mjs';
import { ONG_TUTORIALS } from './ong.mjs';
import { PME_TUTORIALS } from './pme.mjs';

export const TUTORIALS = [...COMMON_TUTORIALS, ...ECOLE_TUTORIALS, ...ONG_TUTORIALS, ...BTP_TUTORIALS, ...PME_TUTORIALS];
