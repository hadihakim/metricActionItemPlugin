// The big object that contains all the metrics
let metrics = {};

// We used nodeSelector to determine where are we inside the big object
let nodeSelector = "metrics";

let currentUser;

// Reference to the progress bar in (update histroy value page)
let bar = {};

// Reference to hammer in (update histroy value page)
let hammer = {};

// Reference to the values chart in metrics lists' page
let valuesChart = {};

// A variable that is used to set how many times to pop the breadcrumb when the control side go back multiple levels at once
let numberOfPops = 0;

// Get the app's theme to utilize its colors in design
let appThemeObj = {};

buildfire.appearance.getAppTheme(function (err, appTheme) {
  appThemeObj = appTheme;
});
// Get the logged in user
const getCurrentUser = () => {
  return authManager.getCurrentUser().then((user) => {
    currentUser = user;
  });
};

getCurrentUser();

// Login and Logout listners
buildfire.auth.onLogin(() => getCurrentUser());
buildfire.auth.onLogout(() => (currentUser = null));

buildfire.deeplink.getData((data) => {
  if (data && data.link) {
    console.log("data.link", data);
    nodeSelector = data.link;
    // buildfire.history.push(data.title, {
    //   nodeSelector,
    //   showLabelInTitlebar: true,
    // });
  }
});

// Get all user bookmarks
// let bookmarks = {};

// const getBookmarks = () => {
//   buildfire.bookmarks.getAll((bookmarks) => {
//     if (bookmarks) {
//       bookmarks.forEach((bookmark) => {
//         bookmarks[bookmark.id] = bookmark.id;
//       });
//     }
//   });
// };

// To sync betwwen the widget and the control when any change (in metrics) happened in the control side
buildfire.publicData.onUpdate((event) => {
  if (event.data && event.id) {
    metrics = event.data;
    metrics.id = event.id;
    renderInit();
  }
});

// To sync betwwen the widget and the control when any change (in settings) happened in the control side
buildfire.datastore.onUpdate((event) => {
  if (event.tag === "settings") {
    Settings.load().then(() => {
      renderInit();
    });
  }
});
// To get all metrics and start rendering
Metrics.getMetrics().then(async (result) => {
  metrics = result;
  initMaterialComponents();

  await Settings.load().then(() => {
    // To prevent Functional Tests from Applying these lines where it will cause some errors
    // Check if the user have the permission to update metrics
    isUserAuthorized();

    renderInit();
  });
});

// To initialize and prepare metrics to be rendered
const renderInit = () => {
  listViewContainer.innerHTML = "";
  console.log("Hello everybody", nodeSelector, metrics);
  // Extract the desired metrics (children) from the big object using nodeSelector
  let readyMetrics = helpers.nodeSplitter(nodeSelector, metrics);
  // Hide the summary in the Home Page if the settings is set to hide it
  if (nodeSelector === "metrics" && !Settings.showSummary) {
    helpers.hideElem("#summary");
  } else {
    helpers.showElem("#summary");
  }
  // Get metrics that should be rendered
  let metricsChildren = readyMetrics.metricsChildren;
  // Init metrics values' chart
  initChart(readyMetrics.metricsParent);

  document.getElementById("metricDescription").innerHTML =
    readyMetrics.metricsParent.description || "<p>No Value</p>";

  let currentMetricList = [];
  // Prepare metrics to be rendered in the ListView component
  for (let metricId in metricsChildren) {
    metricsChildren[metricId].id = metricId;
    let newMetric = new Metric(metricsChildren[metricId]);
    let InitMetricAsItem = metricAsItemInit(newMetric);
    currentMetricList.push(InitMetricAsItem);
  }
  // Add the summary value of the parent metric
  summaryValue.innerText = `${readyMetrics.metricsParent.value || 0}%`;

  checkIncreaseOrDecrease(readyMetrics);

  currentMetricList = helpers.sortMetrics(
    currentMetricList,
    readyMetrics.metricsSortBy
  );
  renderMetrics(currentMetricList);
};

// Render metrics using ListView component
const renderMetrics = (metrics) => {
  listViewDiv = new ListView("listViewContainer", {
    enableAddButton: true,
    Title: "",
  });
  listViewDiv.loadListViewItems(metrics);
};

const checkIncreaseOrDecrease = (metrics) => {
  // Calculate the percentage increase or decreased compared to the previous value for the metric;
  let situation;
  let situationClass;
  if (metrics.metricsParent.value > metrics.metricsParent.previousValue) {
    situation = "trending_up";
    situationClass = "mdc-theme--secondary";
  } else if (
    metrics.metricsParent.value < metrics.metricsParent.previousValue
  ) {
    situation = "trending_down";
    situationClass = "mdc-theme--error";
  } else {
    situation = "remove";
    situationClass = "mdc-theme--text-primary-on-background";
  }
  // Calculation source: http://mathcentral.uregina.ca/qq/database/qq.09.06/h/other1.html
  let percentage =
    metrics.metricsParent.value - metrics.metricsParent.previousValue;

  percentage = percentage.toPrecision(3);

  summaryPreviousValueContainer.innerHTML = `
      <i
      class="material-icons mdc-button__icon ${situationClass} trending-icon">${situation}</i >
      <span id="summaryPreviousValue">${percentage || 0}%</span>
      `;

  // Add the metric title to the summary card;
  summaryTitle.innerHTML = metrics.metricsParent.title || "Home";
};

// Initialize metics to be rendered using list view library
const metricAsItemInit = (newMetric) => {
  let listItem = new ListViewItem(newMetric);
  listItem.onIconTitleClick = (item) => {
    if (Object.keys(item.actionItem).length > 0) {
      buildfire.actionItems.execute(item.actionItem, () => {
        console.log("Action Done");
      });
    }
  };
  listItem.onToolbarClicked = (e) => {
    if (newMetric.type === "parent") {
      nodeSelector += `.${newMetric.id}.metrics`;
      buildfire.history.push(newMetric.title, {
        nodeSelector,
        // metricType: newMetric.type,
        showLabelInTitlebar: true,
      });
      buildfire.messaging.sendMessageToControl({
        title: newMetric.title,
        nodeSelector,
      });

      renderInit();
    } else {
      if (currentUser && isUserAuthorized()) {
        helpers.hideElem("#metricsScreen");
        helpers.showElem("#updateHistoryContainer, #updateHistoryButton");

        nodeSelector += `.${newMetric.id}`;

        buildfire.history.push(`Update ${newMetric.title}`, {
          nodeSelector,
          showLabelInTitlebar: true,
        });

        // helpers.getElem("#bookmark").querySelector("button").onclick = () => {
        //   if (!bookmarks[newMetric.id]) {
        //     const options = {
        //       id: newMetric.id,
        //       title: newMetric.title,
        //       icon: newMetric.icon,
        //       payload: {
        //         data: { link: nodeSelector },
        //       },
        //     };

        //     buildfire.bookmarks.add(options, () => {
        //       // Change bookmarks button icon
        //       helpers.getElem("#bookmarks button").innerText = "star";
        //       // Add the bookmarked item to the global bookmarks object
        //       bookmarks[newMetric.id] = newMetric.id;
        //     });
        //   } else {
        //     buildfire.bookmarks.delete(newMetric.id, () => {
        //       // Change bookmarks button icon
        //       helpers.getElem("#bookmarks button").innerText = "star_outlined";
        //       // Remove the bookmarked item to the global bookmarks object
        //       delete bookmarks[newMetric.id];
        //     });
        //   }
        // };

        // Add onclick handler to add notes icon inorder to add notes
        helpers.getElem("#notes").querySelector("button").onclick = () => {
          // Get the parent path for the metric
          let itemPath = nodeSelector.split(".");
          itemPath.pop();
          itemPath = itemPath.join(".");

          const options = {
            itemId: itemPath,
            title: newMetric.title,
            imageUrl: newMetric.icon,
          };

          buildfire.notes.openDialog(options, () => {});
        };

        // helpers.getElem("#share").querySelector("button").onclick = () => {
        //   const options = {
        //     itemId: nodeSelector,
        //     title: newMetric.title,
        //     imageUrl: newMetric.icon,
        //   };

        //   buildfire.notes.openDialog(options, () => {});
        // };

        updateHistoryBtn.onclick = (event) => {
          const value = Math.round(bar.value() * 100); // the value of the progressbar

          Metrics.updateMetricHistory(
            { nodeSelector, metricsId: metrics.id },
            { value, username: currentUser.firstName }
          ).then((result) => {
            metrics = result;
            buildfire.history.pop();
          });
        };
        initProgressBar(newMetric);
        document.body.scrollTop = 0;
      }
    }
  };
  return listItem;
};

const initChart = (metric) => {
  // To destroy (delete) any chart in the screen if exists
  if (Object.keys(valuesChart).length !== 0) {
    valuesChart.destroy();
  }

  let title = !metric.title ? `Home History` : `${metric.title} History`;
  let historyValues = [];
  // This for loop calculate and set all the values of all metrics for the last 7 days
  for (let i = 7; i > 0; i--) {
    let value = Metrics.getHistoryValue(metric, i) || 0;
    historyValues.push(value);
  }

  let datasets = [
    {
      label: title,
      data: historyValues,
      backgroundColor: "rgba(101, 116, 205, 0.1)",
      borderColor: appThemeObj.colors.primaryTheme,
      pointBackgroundColor: "#fff",
      pointHoverBackgroundColor: '#fff',
      borderWidth: 2,
      fill: true,
    },
  ];
  renderChart(datasets);
};

const renderChart = (datasets) => {
  const ctx = document.getElementById("chart").getContext("2d");

  valuesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: helpers.getLast7Days(),
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      spanGaps: false,
      legend: {
        display: false,
      },
      elements: {
        point: {
          radius: 3,
          hitRadius: 20,
          borderWidth: 2,
          hoverRadius: 5,
          hoverBorderWidth: 1,
        },
        line: {
          tension: 0,
        },
      },
      layout: {
        padding: {
          top: 6,
          left: 6,
          right: 6,
          bottom: 6,
        },
      },
      scales: {
        xAxes: [
          {
            display: false,
          },
        ],
        yAxes: [
          {
            display: false,
          },
        ],
      },
    },
  });
};

const initProgressBar = (newMetric) => {
  if (Object.keys(bar).length !== 0) {
    bar.destroy();
  }
  // updateMetricHistory progress bar
  bar = new ProgressBar.SemiCircle("#progressbar-container", {
    strokeWidth: 10,
    color: "#FFEA82",
    trailColor: "#eee",
    trailWidth: 10,
    easing: "easeInOut",
    duration: 500,
    svgStyle: null,
    text: {
      value: "",
      alignToBottom: true,
    },
    from: { color: appThemeObj.colors.dangerTheme },
    to: { color: appThemeObj.colors.primaryTheme },
    // Set default step function for all animate calls
    step: (state, bar) => {
      bar.path.setAttribute("stroke", state.color);
      var value = Math.round(bar.value() * (newMetric.max - newMetric.min));
      if (value === 0) {
        bar.setText(0);
      } else {
        bar.setText(value);
      }
      bar.text.style.color = state.color;
    },
  });

  bar.set(Math.round(newMetric.value) / 100);
  let progressText = document.getElementsByClassName("progressbar-text")[0];
  progressText.innerHTML = parseInt(progressText.innerHTML) + newMetric.min;
  minMax.innerHTML = `Min ${newMetric.min} - Max ${newMetric.max}`;

  bar.text.style.fontFamily = '"Raleway", Helvetica, sans-serif';
  bar.text.style.fontSize = "2rem";

  InitHammerJS(newMetric);
};
const InitHammerJS = (newMetric) => {
  if (Object.keys(hammer).length !== 0) {
    hammer.destroy();
  }

  // Init hammerJs gesture detection on element
  let updateHistoryContainer = document.getElementById(
    "updateHistoryContainer"
  );
  // create an instance of Hammer
  hammer = new Hammer(updateHistoryContainer);
  hammer
    .get("pan")
    .set({ direction: Hammer.DIRECTION_VERTICAL, threshold: 25 });

  // listen to events...
  hammer.on("panup pandown", (ev) => {
    if (Math.round(ev.distance) % 1 === 0) {
      // console.log(Math.round(ev.distance));
      changeProgressbarValue(ev.type, newMetric);
    }
  });
};

const changeProgressbarValue = (direction, newMetric) => {
  let progressText = document.getElementsByClassName("progressbar-text")[0];
  if (direction === "pandown" && bar.value() >= 0.0000000001) {
    bar.set(bar.value() - 0.01);
    progressText.innerHTML = parseInt(progressText.innerHTML) + newMetric.min;
  } else if (direction === "panup" && bar.value() <= 0.99999999999) {
    bar.set(bar.value() + 0.01);
    progressText.innerHTML = parseInt(progressText.innerHTML) + newMetric.min;
  }
};

const isUserAuthorized = () => {
  if (!currentUser) return false;

  let authorized = false;
  let currentTags = {};
  if (Settings.tags.length === 0) {
    authorized = true;
  } else {
    Settings.tags.forEach((tag) => {
      currentTags[tag.tagName] = tag.tagName;
    });

    if (currentUser && currentUser.tags) {
      currentUser.tags[Object.keys(currentUser.tags)[0]].forEach((tag) => {
        if (currentTags[tag.tagName]) {
          authorized = true;
        }
      });
    }
  }
  return authorized;
};

const initMaterialComponents = () => {
  document.querySelectorAll(".mdc-button").forEach((btn) => {
    mdc.ripple.MDCRipple.attachTo(btn);
  });

  document.querySelectorAll(".mdc-fab").forEach((btn) => {
    mdc.ripple.MDCRipple.attachTo(btn);
  });
};

buildfire.history.onPop((breadcrumb) => {
  // It is a way to go back multiple times in widget when the control side go back multiple levels at once
  if (numberOfPops) {
    --numberOfPops;
    nodeSelector = breadcrumb.options.nodeSelector || "metrics";

    helpers.showElem("#metricsScreen");
    helpers.hideElem("#updateHistoryContainer, #updateHistoryButton");

    renderInit();

    if (numberOfPops) {
      buildfire.history.pop();
    }
  } else {
    //  This condition is for preventing the control side from going back (when clicking back in widget)
    // when we are at the home, which would lead to an error
    // if (Object.keys(breadcrumb.options).length > 0) {
    helpers.showElem("#metricsScreen");
    helpers.hideElem("#updateHistoryContainer, #updateHistoryButton");

    nodeSelector = breadcrumb.options.nodeSelector || "metrics";
    buildfire.messaging.sendMessageToControl({ nodeSelector });
    renderInit();
    // }
  }
});

buildfire.messaging.onReceivedMessage = (message) => {
  // To reload the widget side when the user navigate between tabs then return to the content tab, where we should reset everything
  if (message.cmd == "refresh") {
    if (nodeSelector != "metrics") {
      location.reload();
    }
  } else if (message.numberOfPops) {
    numberOfPops = message.numberOfPops;
    // To check if the the screens in both sides (control & widget) are the same
    // (For example, if the widget on the update history value screen (which is not existed in the cotrol);
    // So we have to pop another time to sync between the two sides
    if (message.nodeSelector !== nodeSelector) {
      numberOfPops++;
    }
    buildfire.history.pop();
  } else {
    nodeSelector = message.nodeSelector;
    buildfire.history.push(message.title, {
      nodeSelector,
      showLabelInTitlebar: true,
    });
    renderInit();
    helpers.showElem("#metricsScreen");
    helpers.hideElem("#updateHistoryContainer, #updateHistoryButton");
  }
};

const closeUpdateHistory = () => {
  return buildfire.history.pop();
};
