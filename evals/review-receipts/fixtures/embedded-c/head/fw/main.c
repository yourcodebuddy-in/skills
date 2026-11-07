#include <stdbool.h>

#include "board.h"

static bool button_pressed = false;

void EXTI0_IRQHandler(void) {
    button_pressed = true;
}

int run(void) {
    while (1) {
        if (button_pressed) {
            button_pressed = false;
            led_toggle();
        }
    }
    return 0;
}
