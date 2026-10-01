// Hand-drawn vector interpretation of the original InTouch mark (1240 x 731).
// Keep the hands independent: the baked-in PNG glow is recreated by the motion layer.
export const SPLASH_BACKGROUND = "#07101f";
export const MARK_WIDTH = 220;
export const MARK_HEIGHT = (MARK_WIDTH * 731) / 1240;
export const MOTION_DURATION_MS = 1_300;

export const AMBER_HAND = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 731">
<defs>
  <linearGradient id="amber-base" x1="140" y1="660" x2="545" y2="365" gradientUnits="userSpaceOnUse"><stop stop-color="#bc3706"/><stop offset=".43" stop-color="#f77700"/><stop offset=".8" stop-color="#ffb900"/><stop offset="1" stop-color="#ffe986"/></linearGradient>
  <linearGradient id="amber-fingers" x1="434" y1="431" x2="586" y2="558" gradientUnits="userSpaceOnUse"><stop stop-color="#b43b00"/><stop offset=".55" stop-color="#e46c00"/><stop offset="1" stop-color="#ffb711"/></linearGradient>
  <linearGradient id="amber-light" x1="259" y1="594" x2="580" y2="357" gradientUnits="userSpaceOnUse"><stop stop-color="#ff9500" stop-opacity="0"/><stop offset="1" stop-color="#fff1a0" stop-opacity=".85"/></linearGradient>
</defs>
<path d="M399 453 C448 429 488 432 525 459 C548 481 561 517 578 548 C586 565 570 577 557 563 L517 510 L454 488 C441 510 419 525 392 514 Z" fill="url(#amber-fingers)"/>
<path d="M429 418 C470 408 511 421 551 443 C575 458 599 478 618 497 C632 512 612 524 598 509 L548 478 C516 472 485 464 454 463 L413 483 Z" fill="url(#amber-base)"/>
<path d="M48 646 C129 630 182 589 239 534 C273 501 296 456 338 430 C377 406 417 401 458 388 L585 346 C598 342 607 344 607 355 C606 372 581 385 562 394 L466 435 C426 457 397 482 381 517 C368 545 384 555 409 550 C437 545 457 526 481 519 C500 513 517 520 522 532 C530 551 510 561 491 569 C470 580 448 598 421 613 C386 636 353 655 312 667 C221 697 124 683 48 646 Z" fill="url(#amber-base)"/>
<path d="M51 646 C153 654 218 604 270 548 C305 508 321 472 364 445 C409 418 462 414 498 398 L586 349 C598 345 603 348 601 357 C595 373 566 385 551 392 L460 432 C413 456 386 486 376 515 C363 548 384 562 411 555 C372 576 326 557 315 544 C276 607 226 649 166 658 C126 663 85 655 51 646 Z" fill="url(#amber-light)"/>
<path d="M51 646 C118 678 229 679 303 656 C346 643 391 616 423 596 C371 650 298 678 238 681 C162 685 92 669 51 646 Z" fill="#c54d00" opacity=".32"/>
<path d="M481 524 C497 517 510 523 516 532 C520 542 509 550 497 555 C483 553 473 542 481 524 Z" fill="#ffd349" opacity=".75"/>
<path d="M242 532 C278 493 298 456 339 432 C384 406 431 400 467 388 L587 347 C598 344 604 347 604 354" fill="none" stroke="#ffe58a" stroke-width="4" stroke-linecap="round" opacity=".8"/>
</svg>`;

export const BLUE_HAND = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 731">
<defs>
  <linearGradient id="blue-base" x1="662" y1="341" x2="1139" y2="68" gradientUnits="userSpaceOnUse"><stop stop-color="#a3f6ff"/><stop offset=".22" stop-color="#19c7f0"/><stop offset=".62" stop-color="#008af5"/><stop offset="1" stop-color="#0048cf"/></linearGradient>
  <linearGradient id="blue-shade" x1="808" y1="337" x2="1117" y2="83" gradientUnits="userSpaceOnUse"><stop stop-color="#045895"/><stop offset=".45" stop-color="#103664"/><stop offset="1" stop-color="#111b35"/></linearGradient>
  <linearGradient id="blue-fingers" x1="801" y1="273" x2="825" y2="440" gradientUnits="userSpaceOnUse"><stop stop-color="#063465"/><stop offset=".65" stop-color="#0273c2"/><stop offset="1" stop-color="#0cbce5"/></linearGradient>
</defs>
<path d="M790 262 C782 303 765 349 760 399 L760 426 C761 443 781 446 788 429 L810 338 L836 286 Z" fill="url(#blue-fingers)"/>
<path d="M819 283 C804 325 814 365 829 405 L841 431 C851 447 872 431 865 417 L849 370 L854 309 Z" fill="url(#blue-fingers)"/>
<path d="M861 265 C879 294 913 330 940 358 C952 372 969 360 957 345 L916 292 L897 245 Z" fill="url(#blue-fingers)"/>
<path d="M1192 64 C1101 36 1030 47 956 79 C904 102 855 132 819 158 L708 270 C684 293 660 313 641 328 C628 340 638 350 653 344 C681 334 704 315 729 296 L794 248 C819 230 842 223 861 232 C882 244 882 260 869 285 L826 337 C815 352 814 366 827 375 C841 385 854 370 863 357 L909 303 C953 280 987 239 1008 195 C1039 125 1083 80 1192 64 Z" fill="url(#blue-base)"/>
<path d="M1192 64 C1107 49 1051 91 1024 135 C1002 172 994 213 966 243 C946 265 925 280 909 303 L863 357 C883 322 895 297 894 270 C894 242 878 229 863 229 C893 196 914 171 945 145 C1012 90 1091 56 1192 64 Z" fill="url(#blue-shade)"/>
<path d="M824 160 C777 217 709 286 641 334 C635 343 644 345 655 340 C684 329 705 308 731 290 L802 238 C830 220 853 216 875 232 C891 210 894 188 872 190 C849 191 829 201 811 214 C853 163 909 113 956 81 C902 102 854 134 824 160 Z" fill="#03b9f2" opacity=".48"/>
<path d="M827 341 C837 333 848 339 852 349 C855 359 844 374 834 376 C821 372 820 353 827 341 Z" fill="#24cdf2" opacity=".72"/>
<path d="M1190 63 C1102 38 1030 49 956 81 C903 104 855 135 821 160 L710 272 C682 299 659 316 641 331 C634 338 638 345 647 344" fill="none" stroke="#8aecff" stroke-width="4" stroke-linecap="round" opacity=".78"/>
</svg>`;

/** One deterministic timeline shared by native rendering and the review preview. */
export function sampleSplashMotion(time: number) {
  "worklet";
  const phase = (start: number, duration: number) =>
    Math.max(0, Math.min(1, (time - start) / duration));
  const ease = (value: number) => 1 - (1 - value) ** 3;
  const approach = ease(phase(180, 440));
  const spark = phase(620, 380);
  const reveal = ease(phase(900, 400));
  const blueRing = ease(phase(680, 530));
  const amberRing = ease(phase(760, 540));
  return {
    vectorOpacity: phase(0, 180),
    amberX: -48 * (1 - approach),
    amberY: 28 * (1 - approach),
    blueX: 48 * (1 - approach),
    blueY: -28 * (1 - approach),
    rotation: 2.5 * (1 - approach),
    // Quadratic arc from the blue fingertip to the amber fingertip.
    sparkX:
      (1 - spark) ** 2 * 646 + 2 * (1 - spark) * spark * 620 + spark ** 2 * 599,
    sparkY:
      (1 - spark) ** 2 * 337 + 2 * (1 - spark) * spark * 311 + spark ** 2 * 353,
    sparkOpacity: phase(620, 70) * (1 - phase(950, 150)),
    sparkWarmth: spark,
    blueRadius: 16 + blueRing * 175,
    blueOpacity: phase(680, 80) * (1 - blueRing) * 0.7,
    amberRadius: 12 + amberRing * 140,
    amberOpacity: phase(760, 80) * (1 - amberRing) * 0.55,
    revealRadius: reveal * 170,
    wordmarkOpacity: phase(900, 150),
    wordmarkY: 8 * (1 - reveal),
  };
}
