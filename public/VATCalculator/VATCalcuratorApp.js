var VATCalculatorApp = angular.module("VATCalculatorApp", ['ngRoute', 'ngGrid', 'ngAnimate', 'ui.bootstrap', 'ngSanitize']);

VATCalculatorApp.config(function($routeProvider){
    $routeProvider.when("/", {
        controller: "VATCalculatorCtrl",
        templateUrl: "VATCalculatorView.html"
    });
});