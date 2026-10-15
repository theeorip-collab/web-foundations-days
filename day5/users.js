
const loadButton = document.getElementById("load-users");
const filterInput = document.getElementById("filter-input");
const status = document.getElementById("status");
const usersList = document.getElementById("users-list");

let users = [];

async function loadUsers() {
  loadButton.disabled = true;
  status.textContent = "Loading users...";

  try {
    const response = await fetch(
      "https://jsonplaceholder.typicode.com/users"
    );

    if (!response.ok) {
      throw new Error("Failed to load users.");
    }

    users = await response.json();
    renderUsers(users);
    status.textContent = `Successfully loaded ${users.length} users.`;
  } catch (error) {
    status.textContent = "Error loading users. Please try again.";
    console.error(error);
  } finally {
    loadButton.disabled = false;
  }
}

function renderUsers(list) {
  usersList.replaceChildren();

  if (list.length === 0) {
    usersList.textContent = "No users match your filter.";
    return;
  }

  list.forEach((user) => {
    const card = document.createElement("article");
    const name = document.createElement("h2");
    const email = document.createElement("p");
    const city = document.createElement("p");
    const company = document.createElement("p");

    name.textContent = user.name;
    email.textContent = `Email: ${user.email}`;
    city.textContent = `City: ${user.address.city}`;
    company.textContent = `Company: ${user.company.name}`;

    card.append(name, email, city, company);
    usersList.appendChild(card);
  });
}

loadButton.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
  const searchTerm = filterInput.value.toLowerCase().trim();

  const filteredUsers = users.filter((user) => {
    const searchableText = [
      user.name,
      user.email,
      user.address.city,
      user.company.name
    ].join(" ").toLowerCase();

    return searchableText.includes(searchTerm);
  });

  renderUsers(filteredUsers);
});
