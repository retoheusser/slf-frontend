(function() {
  "use strict";

  angular.module('slf', [])
    .constant('types', [
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
    ])
    .constant('years', [2016, 2017])
    .component('global', {
      templateUrl: 'global.html',
      controller: GlobalController
    })
    .component('singleView', {
      bindings: {
        images: '<'
      },
      templateUrl: 'singleView.html',
      controller: SingleViewController
    })
    .component('slider', {
      bindings: {
        dates: '<',
        selectedDate: '<',
        onUpdate: '&'
      },
      template: '<div class="slider"></div>',
      controller: SliderController
    });

  GlobalController.$inject = ["$http"];
  function GlobalController($http) {
    var $ctrl = this;

    $http.get("https://s3.eu-central-1.amazonaws.com/slf.stijnvermeeren.be/data.json").then(
      function(response) {
        $ctrl.images = response.data;
      }
    );
  }

  SingleViewController.$inject = ['$scope', 'years', 'types'];
  function SingleViewController($scope, years, types) {
    var $ctrl = this;

    $ctrl.years = years;
    $ctrl.types = types;
    $ctrl.year = 2017;
    $ctrl.type = '1day';

    $ctrl.dates = [];

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
            return item.split(".")[0];
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
            var target = dateToInt($ctrl.date);
            var minDiff;
            var bestMatch;

            $ctrl.dates.forEach(function (date) {
              var diff = Math.abs(dateToInt(date) - target);
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
              newImage = "https://s3.eu-central-1.amazonaws.com/slf.stijnvermeeren.be/" + $ctrl.year + "/" + $ctrl.type + "/" + item;
            }
          })
        }

        console.log("Image", $ctrl.year, $ctrl.type, $ctrl.date);

        $ctrl.image = newImage;
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
          to: function(value) {
            return intToDate(value);
          },
          from: function(value) {
            return dateToInt(value);
          }
        }
      });

      slider.on('update', function(values) {
        // don't use $scope.$apply because of https://docs.angularjs.org/error/$rootScope/inprog?p0=$digest
        $timeout(function() {
          $ctrl.onUpdate({ date: values[0] })
        }, 0);
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

  var millisPerDay = 60 * 60 * 24 * 1000;

  function dateToInt(date) {
    return new Date(date).getTime() / millisPerDay;
  }

  function intToDate(int) {
    var date = new Date(int * millisPerDay);
    var d = date.getDate();
    var m = date.getMonth() + 1;
    var y = date.getFullYear();
    return '' + y + '-' + (m<=9 ? '0' + m : m) + '-' + (d <= 9 ? '0' + d : d);
  }

})();
