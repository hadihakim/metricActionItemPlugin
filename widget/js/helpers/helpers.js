// A helper function to extract the date: Format: "year/month/day"
const helpers = {
  uuidv4: (m = Math, d = Date, h = 16, s = (s) => m.floor(s).toString(h)) =>
    s(d.now() / 1000) + " ".repeat(h).replace(/./g, () => s(m.random() * h)),
  // Return absolute date
  getAbsoluteDate: () => new Date(new Date().setHours(0, 0, 0, 0)),
  nodeSplitter: (nodeSelector, metrics) => {
    let splittedNode = nodeSelector.split(".");
    let metricsChildren = metrics;
    let metricsParent = null;
    let metricsSortBy = "";

    splittedNode.forEach((item, i) => {
      // If we are at the home page (top of the object)
      if (nodeSelector === "metrics") {
        metricsParent = metrics;
        metricsSortBy = metrics.sortBy;
      }
      // Assign the parent metric sortBy value (If we are in parent metric);
      if (nodeSelector !== "metrics" && i === splittedNode.length - 2) {
        metricsParent = metricsChildren[item];
        metricsSortBy = metricsChildren[item].sortBy;
      }

      metricsChildren = metricsChildren[item];
    });
    return { metricsChildren, metricsSortBy, metricsParent };
  },
  sortMetrics: (currentMetricList, sortBy) => {
    // Sort metrics based sortBy value
    if (sortBy === "highest") {
      currentMetricList.sort((a, b) => b.value - a.value);
    } else if (sortBy === "lowest") {
      currentMetricList.sort((a, b) => a.value - b.value);
    } else {
      currentMetricList.sort((a, b) => a.order - b.order);
    }
    return currentMetricList;
  },
};
