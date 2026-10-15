
# Library Books REST API

## Resource

- Resource name: Books
- Base URL: `/api/books`
- Data format: JSON
- Each book has an ID, title, author, publication year and ISBN.

## Endpoints

### 1. List all books
- Method: GET
- Endpoint: `/api/books`
- Purpose: Returns all books.
- Success: `200 OK`

### 2. Get a book by ID
- Method: GET
- Endpoint: `/api/books/:id`
- Purpose: Returns one book by its ID.
- Success: `200 OK`
- Error: `404 Not Found` if the book does not exist.

### 3. Create a book
- Method: POST
- Endpoint: `/api/books`
- Purpose: Adds a new book.
- Request body: JSON containing the title, author, publication year and ISBN.
- Success: `201 Created`
- Error: `400 Bad Request` if the data is invalid.

### 4. Update a book
- Method: PUT
- Endpoint: `/api/books/:id`
- Purpose: Replaces the details of an existing book.
- Request body: JSON containing the updated book details.
- Success: `200 OK`
- Error: `404 Not Found` if the book does not exist.

### 5. Delete a book
- Method: DELETE
- Endpoint: `/api/books/:id`
- Purpose: Deletes a book by its ID.
- Success: `204 No Content`
- Error: `404 Not Found` if the book does not exist.

### 6. Find books by author
- Method: GET
- Endpoint: `/api/books?author=:author`
- Purpose: Returns books matching the specified author.
- Success: `200 OK`
- Error: `400 Bad Request` if the query parameter is invalid.

## Error Responses

- `400 Bad Request`: The request data is invalid.
- `404 Not Found`: The requested book does not exist.
- `500 Internal Server Error`: An unexpected server error occurred.

## Example Book

```json
{
  "id": 1,
  "title": "Things Fall Apart",
  "author": "Chinua Achebe",
  "publicationYear": 1958,
  "isbn": "9780385474542"
}
```
