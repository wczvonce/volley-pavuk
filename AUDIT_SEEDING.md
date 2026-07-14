# Audit importu nasadenia

Dátum auditu: 14. 7. 2026

## Oficiálne pravidlá SVF 2026

Zdroj: https://admin.slovakvolley.sk/assets/d48ae1bd-05c8-4072-ba47-80dabc5f418e

- Dvojice sa nasadzujú podľa ENTRY rebríčka.
- Pri hlavnej súťaži pre 16 dvojíc má prvých 8 dvojíc právo priamej účasti.
- Miesta 9 a 10 sú určené pre dve možné divoké karty; nevyužité miesta sa doplnia podľa ENTRY.
- O zostávajúce miesta sa môže hrať kvalifikácia.
- Ak je v kvalifikácii menej než 16 dvojíc, Q1 a Q2 môžu byť presunuté priamo do hlavnej súťaže.
- Počet a systém postupujúcich závisí od schváleného systému kvalifikácie.

Preto aplikácia nesmie počet postupujúcich vždy určiť iba vzorcom `16 - počet priamo nasadených`.

## Overené historické prípady

| Turnaj | Priamo v hlavnej súťaži | Dvojice v kvalifikácii | Postupujúci | BYE v 16-seedovom okne | Výsledok auditu |
|---|---:|---:|---:|---:|---|
| Ružomberok A 2026 | 10 | 20 | 6 | 0 | fallback doplní hlavný pavúk do 16 |
| Prešov A 2026 | 12 | 9 | 4 | 0 | zhoduje sa s kvalifikáciou a Main Draw |
| Valčianska dolina A 2025 | 14 | 4 | 2 | 0 | počet je načítaný z pokynu kvalifikácie |
| Strážske B 2024 | 8 | 9 | 4 | 4 | 12 účastníkov hlavnej súťaže v 16-seedovom okne |
| Strážske B 2026 | po odhlásení sa prečísluje | bez kvalifikácie | 0 | podľa aktívnych dvojíc | odhlásený duplicitný riadok sa ignoruje |
| Modelový prípad 14 prihlásených | 14 | 0 | 0 | 2 | dve skutočné BYE |

Historické podklady boli porovnané medzi tabuľkami Nasadenie, Kvalifikácia a hotovými mužskými Main Draw súbormi v používateľovom Google Drive.

## Overenie rozloženia seedov

Prvé kolo používa historicky používané rozloženie:

1. S1 – S16
2. S9 – S8
3. S5 – S12
4. S13 – S4
5. S3 – S14
6. S11 – S6
7. S7 – S10
8. S15 – S2

Toto rozloženie sa zhoduje s mužskými Main Draw súbormi Prešov A 2026 aj Strážske B 2026.

## Opravené okrajové prípady

- importuje iba blok označený `MUŽI / MEN`, nie pomocné hárky Muži alebo Ženy,
- podporuje meno v jednom stĺpci aj oddelené stĺpce meno/priezvisko,
- rozlišuje číselné nasadenie, Q1–Qn a rezervy `res.`,
- akceptuje aj označenie ako `Q4*`,
- číta počet postupujúcich z textu kvalifikácie alebo tabuľky postupujúcich,
- ak počet nie je uvedený, doplní kvalifikantov do kapacity 16,
- BYE vytvorí iba za neobsadené miesta hlavnej súťaže,
- riadok označený ako odhlásenie vynechá,
- dve aktívne dvojice s rovnakým seedom považuje za chybu namiesto tichého prepísania,
- prázdne riadky Q1–Qn v už pripravenom Main Draw chápe ako miesta pre kvalifikantov, nie ako BYE.

## Automatické testy

Spustenie:

```bash
node tests/seed-excel-audit.test.js
```

Testy pokrývajú všetky prípady uvedené v tabuľke vyššie a kontrolujú aj štandardné rozloženie seedov v prvom kole.
