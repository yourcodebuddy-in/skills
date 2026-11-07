#ifndef LIST_H
#define LIST_H

struct node {
    int value;
    char tag[32];
    struct node *next;
};

int list_push(struct node **head, int value);
int list_remove(struct node **head, int value);
void list_free(struct node *head);

#endif
