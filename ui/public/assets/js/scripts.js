// Create an event listener for the mobile menu button
// When the button is clicked, toggle the class 'is-active' on the menu
// This will show/hide the menu when the button is clicked
document
  .getElementById("mobile-menu-button")
  .addEventListener("click", function () {
    console.log("Activated");
    document.getElementById("mobile-menu").classList.remove("hidden");
  });

document
  .getElementById("mobile-menu-close")
  .addEventListener("click", function () {
    console.log("Deactivated");
    document.getElementById("mobile-menu").classList.add("hidden");
  });
