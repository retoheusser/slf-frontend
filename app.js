(function() {
  "use strict";

  var app = angular.module('slf', []);

  app.constant('types', [
    {
      'key': 'depth',
      'title': 'Snow depth'
    },
    {
      'key': 'at2000m',
      'title': 'Snow depth at 2000m/2500m'
    },
    {
      'key': 'relative',
      'title': 'Snow depth percentage of long-term mean values'
    },
    {
      'key': '1day',
      'title': 'Fresh snow 1 day'
    },
    {
      'key': '3days',
      'title': 'New snow 3 days'
    }
  ]);

  app.component('global', {
    templateUrl: 'global.html',
    controller: GlobalController
  });

  app.component('singleView', {
    bindings: {
      images: '<',
      years: '<'
    },
    templateUrl: 'singleView.html',
    controller: SingleViewController
  });

  app.component('slider', {
    bindings: {
      dates: '<',
      selectedDate: '<',
      onUpdate: '&'
    },
    template: '<div class="slider"></div>',
    controller: SliderController
  });

  app.directive('imageonload', function() {
    return {
      restrict: 'A',
      link: function(scope, element, attrs) {
        element.bind('load', function() {
          scope.$apply(attrs.imageonload);
        });
      }
    };
  });

  GlobalController.$inject = ["$http"];
  function GlobalController($http) {
    var $ctrl = this;

    $http.get("https://s3.eu-central-1.amazonaws.com/slf.stijnvermeeren.be/data.json").then(
      function(response) {
        $ctrl.images = response.data;
        $ctrl.years = Object.keys($ctrl.images)
          .map(Number)
          .sort()
          .reverse(); // sort descending
      }
    );
  }

  SingleViewController.$inject = ['$scope', 'types'];
  function SingleViewController($scope, types) {
    var $ctrl = this;

    $ctrl.types = types;
    $ctrl.year = 2017;
    $ctrl.type = '1day';
    $ctrl.isLoading = true;

    $ctrl.dates = [];

    $ctrl.imageLoaded = function() {
      $ctrl.isLoading = false;
    };

    $ctrl.updateDate = function(newDate) {
      $ctrl.date = newDate;
    };

    var updateSlider = function() {
      if ($ctrl.year && $ctrl.type) {
        /**
         * Load the new set of available dates for the selected year and map type
         */
        if ($ctrl.images[$ctrl.year] && $ctrl.images[$ctrl.year][$ctrl.type]) {
          $ctrl.dates = $ctrl.images[$ctrl.year][$ctrl.type].map(function (item) {
            return item.split(".")[0]; //remove the file extension from the date-named image
          });
        } else {
          $ctrl.dates = [];
        }

        /**
         * Find the closest match to the previously selected date in the new set of available dates
         */
        if ($ctrl.dates.length > 0) {
          if (!$ctrl.date) {
            $ctrl.date = $ctrl.dates[0];
          } else {
            var target = dateToIntRelative($ctrl.date);
            var minDiff;
            var bestMatch;

            $ctrl.dates.forEach(function (date) {
              var diff = Math.abs(dateToIntRelative(date) - target);
              if (minDiff === undefined || diff < minDiff) {
                minDiff = diff;
                bestMatch = date;
              }
            });

            $ctrl.date = bestMatch;
          }
        }

        console.log("Slider", $ctrl.year, $ctrl.type, $ctrl.date);
      }
    };

    var updateImage = function() {
      if ($ctrl.year && $ctrl.type && $ctrl.date) {
        var newImage = undefined;
        if ($ctrl.images[$ctrl.year] && $ctrl.images[$ctrl.year][$ctrl.type]) {
          $ctrl.images[$ctrl.year][$ctrl.type].forEach(function(item) {
            if (item.split(".")[0] == $ctrl.date) {
              newImage = [
                "https://s3.eu-central-1.amazonaws.com/slf.stijnvermeeren.be",
                $ctrl.year,
                $ctrl.type,
                item
              ].join("/");
            }
          });
        }

        console.log("Image", $ctrl.year, $ctrl.type, $ctrl.date);

        $ctrl.image = newImage;
        $ctrl.isLoading = true;
      }
    };

    $scope.$watchGroup(['$ctrl.year', '$ctrl.type'], updateSlider);
    $scope.$watchGroup(['$ctrl.year', '$ctrl.type', '$ctrl.date'], updateImage);
  }

  SliderController.$inject = ['$scope', '$timeout', '$element'];
  function SliderController($scope, $timeout, $element) {
    var $ctrl = this;

    var createSlider = function() {
      console.log("Creating slider with default date", $ctrl.selectedDate);

      // clone array
      var dates = $ctrl.dates.slice(0);

      var startInt = dateToInt(dates.shift());
      var endInt = dateToInt(dates.pop());
      var range = {
        'min': startInt,
        'max': endInt
      };
      dates.forEach(function (date) {
        var dateInt = dateToInt(date);
        var percentage = 100 * (dateInt - startInt) / (endInt - startInt);
        range[percentage + '%'] = dateInt;
      });

      // Leave angular and venture out into the dangerous raw DOM world.
      var elem = $element.find('div')[0];

      var slider = noUiSlider.create(elem, {
        start: $ctrl.selectedDate,
        behaviour: 'tap-drag',
        tooltips: true,
        range: range,
        snap: true,
        pips: {
          mode: 'range',
          density: 1000,
          format: {
            to: function() {
              return '';
            },
            from: function() {
              return '';
            }
          }
        },
        format: {
          to: intToDate,
          from: dateToInt
        }
      });

      slider.on('update', function(values) {
        // don't use $scope.$apply because of https://docs.angularjs.org/error/$rootScope/inprog?p0=$digest
        $timeout(function() {
          $ctrl.onUpdate({ date: values[0] })
        });
      });

      return slider;
    };

    $scope.$watch('$ctrl.dates', function() {
      if ($ctrl.slider) {
        $ctrl.slider.destroy();
      }
      $ctrl.slider = createSlider();
    });
  }

  /**
   * The number of days since the UNIX epoch for the given date string (e.g. '2016-06-29').
   */
  function dateToInt(dateString) {
    var milliseconds = moment(dateString).valueOf();
    return moment.duration(milliseconds).asDays();
  }

  /**
   * The number of days since the last August 1st for the given date string (e.g. '2016-06-29').
   */
  function dateToIntRelative(dateString) {
    var givenDate = moment(dateString);
    var august1st = givenDate.clone().startOf("year").add(7, "months");
    august1st.subtract(august1st.isAfter(givenDate) ? 1 : 0, "years");
    return givenDate.diff(august1st, "days");
  }

  /**
   * Produces the date string (e.g. '2016-06-29') for the given number of days since the UNIX epoch.
   */
  function intToDate(int) {
    return moment(0).add(int, "days").format("YYYY-MM-DD");
  }

})();
