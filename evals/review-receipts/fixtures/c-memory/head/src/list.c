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

int list_remove(struct node **head, int value) {
    int removed = 0;
    struct node **cur = head;
    while (*cur) {
        struct node *n = *cur;
        if (n->value == value) {
            *cur = n->next;
            free(n);
            removed++;
        }
        cur = &n->next;
    }
    return removed;
}

void list_free(struct node *head) {
    while (head) {
        struct node *next = head->next;
        free(head);
        head = next;
    }
}
