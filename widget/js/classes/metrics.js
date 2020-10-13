class Metrics {
  constructor() {}

  static getMetrics() {
    return new Promise((resolve, reject) => {
      buildfire.publicData.get("metrics", async (err, result) => {
        if (err) reject(err);
        else {
          // Check if there is already objects in the database
          if (!result.data.metrics) {
            // If there is no object, then create the parent object
            await buildfire.publicData.save(
              { metrics: {}, sortBy: "manual" },
              "metrics",
              async (err, result) => {
                if (err) reject(err);
                else {
                  await this.getMetrics().then((result) => {
                    resolve(result);
                  });
                }
              }
            );
          } else {
            result.data.id = result.id;
            resolve(result.data);
          }
        }
      });
    });
  }

  static updateMetricHistory({ nodeSelector, metricsId }, value) {
    const absoluteDate = helpers.getAbsoluteDate();

    return new Promise((resolve, reject) => {
      if (!nodeSelector) reject("nodeSelector not provided");
      if (!metricsId) reject("metricsId not provided");

      buildfire.publicData.searchAndUpdate(
        { [`${nodeSelector}.history.date`]: absoluteDate },
        {
          $set: {
            [`${nodeSelector}.history.$.value`]: value,
            [`${nodeSelector}.history.$.lastUpdatedOn`]: new Date(),
            [`${nodeSelector}.history.$.lastUpdatedBy`]: "currentUser.username",
          },
        },
        "metrics",
        async (err, data) => {
          if (err) reject(err);
          if (data.nModified === 0) {
            buildfire.publicData.update(
              metricsId,
              {
                $push: {
                  [`${nodeSelector}.history`]: {
                    date: absoluteDate,
                    createdOn: new Date(),
                    createdBy: "currentUser.username",
                    lastUpdatedOn: new Date(),
                    lastUpdatedBy: "currentUser.username",
                    value,
                  },
                },
              },
              "metrics",
              async (err, result) => {
                if (err) reject(err);
                else {
                  result.data.id = result.id;
                  resolve(result.data);
                }
              }
            );
          }
          // Extract metric id from nodeSelector
          let updatedMetricId = nodeSelector.split(".");
          updatedMetricId = updatedMetricId[updatedMetricId.length - 1];
          // Track action
          Analytics.trackAction(`METRIC_${updatedMetricId}_HISTORY_UPDATE`);

          await Metrics.getMetrics().then((result) => {
            resolve(result);
          });
        }
      );
    });
  }

  static getHistoryValue(metric, inde) {
    if (metric.type === "metric") {
      let todayDate = helpers.getAbsoluteDate();
      for (var i = 1; i <= 7; i++) {
        if (metric.history[metric.history.length - i]) {
          if (
            new Date(
              todayDate - new Date(metric.history[metric.history.length - i].date)
            ).getDate() >= inde
          ) {
            let val = metric.history[metric.history.length - i].value;
            if (inde === 1) {
              metric.value = val || 0;
            } else if (inde === 2) {
              metric.previousValue = val || 0;
            }
            return val;
          }
        }
      }
      return "false";
    } else if (metric.type === "parent" || !metric.type) {
      if (Object.keys(metric.metrics).length === 0) {
        return 0;
      }
      if (metric.metrics) {
        let sum = 0;
        let numberChildren = 0;
        for (let key in metric.metrics) {
          if (Metrics.getHistoryValue(metric.metrics[key], inde) !== "false") {
            numberChildren++;
  
            sum += Metrics.getHistoryValue(metric.metrics[key], inde);
          }
        }
        let avg = sum / numberChildren;
        if (inde === 1) {
          metric.value = parseFloat(avg.toPrecision(3)) || 0;
        } else if (inde === 2) {
          metric.previousValue = parseFloat(avg.toPrecision(3)) || 0;
        }
        return avg;
      }
    }
  }
}