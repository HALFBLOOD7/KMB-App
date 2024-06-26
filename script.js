let stopsData;
let routeStopsData;
let markers = [];
let polylines = [];
let selectedBound = "O"; // Default selected bound
const defaultCord = [22.345415, 114.19264];
const apiAddress = "https://data.etabus.gov.hk/v1/transport/kmb/eta";

// Check if viewport width is less than 768px (typical mobile devices)
const isMobileView = window.innerWidth < 768;
const darkBackground = document.getElementById("darkBackground");

// Function to fetch JSON data
async function fetchData(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  return await response.json();
}

// Map initialization
const map = L.map("map").setView(defaultCord, 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
}).addTo(map);

// Fetch data and initialize map
Promise.all([fetchData("stopList.json"), fetchData("routeStop.json")])
  .then(([stops, routeStops]) => {
    stopsData = stops.data;
    routeStopsData = routeStops.data;
    showRouteStops();
  })
  .catch((error) => {
    console.error("Error initializing map:", error);
  });

// Function to fetch ETA from the API and format it
async function fetchETA(routeID, stopID) {
  try {
    const response = await fetch(`${apiAddress}/${stopID}/${routeID}/1`);
    const data = await response.json();
    const etas = data.data;
    const formattedEtas = etas.map((eta) => {
      const etaTime = new Date(eta.eta);
      const currentTime = new Date();
      const timeDifference = Math.round((etaTime - currentTime) / 60000); // Difference in minutes

      if (timeDifference < 0) {
        return "N/A";
      }
      const hours = String(etaTime.getHours()).padStart(2, "0");
      const minutes = String(etaTime.getMinutes()).padStart(2, "0");

      return `${hours}:${minutes} (${timeDifference} mins)`;
    });

    return formattedEtas
      .filter((x) => x !== "N/A")
      .sort()
      .slice(0, 3);
  } catch (error) {
    console.error("Error fetching ETA:", error);
    return "NA";
  }
}

// Function to clear existing markers and polylines
function clearMap() {
  markers.forEach((marker) => map.removeLayer(marker));
  markers = [];
  polylines.forEach((polyline) => map.removeLayer(polyline));
  polylines = [];
}

// Function to clear the sidebar
function clearSideBar() {
  document.getElementById("stopList").innerHTML = "";
}

// Function to show stops and routes for the given routeID and bound
function showRouteStops() {
  const routeID = document.getElementById("routeIDInput").value;

  clearMap();
  clearSideBar();

  const routeStops = routeStopsData.filter(
    (rs) => rs.routeID === routeID && rs.bound === selectedBound
  );

  if (routeStops.length === 0) {
    alert("No stops found for the given route ID");
    return;
  }

  const routeColors = d3.scaleOrdinal(d3.schemeCategory10);
  const getStopByID = (id) => stopsData.find((stop) => stop.id === id);

  // Add stops to the map and sidebar based on the selected bound
  routeStops.forEach((rs) => {
    const stop = getStopByID(rs.stopID);
    if (stop) {
      const marker = L.marker([stop.lat, stop.long])
        .addTo(map)
        .bindTooltip(stop.name + "\nloading ETA....");

      // Fetch ETA on click
      marker.on("click", async function () {
        const eta = await fetchETA(routeID, stop.id);

        let tempVar = "";
        if (eta.length === 0) {
          tempVar = `<div><span class="etalabel">BETTER LUCK NEXT DAY</span></div>`;
        } else {
          eta.forEach((eta) => {
            tempVar += `<div><span class="etalabel">ETA:</span><span class="eta">${eta}</span></div>`;
          });
        }

        const popupContent = `<div class="custompopup">
          <div class="stopname">${stop.name}</div>
          ${tempVar}
        </div>`;
        marker.bindPopup(popupContent).openPopup();
      });

      markers.push(marker);

      // Add stop to sidebar
      addStopToSidebar(stop, marker);
    }
  });

  // Draw route polyline for the selected bound
  const latlngs = routeStops.map((rs) => {
    const stop = getStopByID(rs.stopID);
    return [stop.lat, stop.long];
  });

  const polyline = L.polyline(latlngs, { color: routeColors(routeID) }).addTo(
    map
  );
  polylines.push(polyline);
  map.panTo([
    getStopByID(routeStops[0].stopID).lat,
    getStopByID(routeStops[0].stopID).long,
  ]);
}

// Function to add a stop to the sidebar
function addStopToSidebar(stop, marker) {
  const stopListContainer = document.getElementById("stopList");
  const stopItem = document.createElement("div");
  stopItem.classList.add("stop-item");
  stopItem.textContent = stop.name;

  //isMobileView
  if (window.innerWidth < 768) {
    stopItem.addEventListener("click", async function () {
      // Create popup element
      const popup = document.createElement("div");
      popup.className = "popup";

      const routeID = document.getElementById("routeIDInput").value;
      const eta = await fetchETA(routeID, stop.id);

      let tempVar = "";
      if (eta.length === 0 || eta === "NA") {
        tempVar = `<div><span class="etalabel">BETTER LUCK NEXT DAY</span></div>`;
      } else {
        eta.forEach((eta) => {
          tempVar += `<div><span class="etalabel">ETA:</span><span class="eta">${eta}</span></div>`;
        });
      }

      popup.innerHTML = `<div class="custompopup">
        <div class="stopname">${stop.name}</div>
        ${tempVar}
      </div>`;

      // Append popup to dark background
      darkBackground.appendChild(popup);

      // Show dark background and popup
      darkBackground.style.display = "block";

      // Close popup when clicking outside (optional)
      darkBackground.addEventListener("click", function (e) {
        if (e.target === darkBackground) {
          darkBackground.style.display = "none";
          darkBackground.removeChild(popup); // Remove popup from DOM
        }
      });
    });
  } else {
    stopItem.addEventListener("click", () => {
      console.log(`panning to ${stop.name}`);
      map.setView([stop.lat, stop.long], 17, { animate: true });

      // Change the marker's color to red to make it visually contrasting
      marker.setIcon(
        new L.Icon({
          iconUrl:
            "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          tooltipAnchor: [16, -28],
          shadowSize: [41, 41],
        })
      );
      // Add vibrating animation to the clicked marker after a short delay
      marker.getElement().classList.add("blink");

      // Remove the blink class to stop the animation
      setTimeout(() => {
        marker.getElement().classList.remove("blink");
      }, 600);

      // Optionally, reset other markers' icons to the default blue one
      markers.forEach((m) => {
        if (m !== marker) {
          m.setIcon(new L.Icon.Default());
        }
      });
    });
  }

  stopListContainer.appendChild(stopItem);
}

// Event listener for radio button change to update selected bound and re-populate sidebar
const boundRadios = document.querySelectorAll('input[name="bound"]');
boundRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    selectedBound = radio.value;
    clearMap();
    clearSideBar();
    showRouteStops();
  });
});
