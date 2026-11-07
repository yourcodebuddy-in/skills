#include "list.h"

#include <stdlib.h>

int list_push(struct node **head, int value) {
    struct node *n = calloc(1, sizeof(*n));
    if (!n) return -1;
    n->value = value;
    n->next = *head;
    *head = n;
    return 0;
}

void list_free(struct node *head) {
    while (head) {
        struct node *next = head->next;
        free(head);
        head = next;
    }
}
