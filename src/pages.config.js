import CounterpointGenerator from './pages/CounterpointGenerator';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CounterpointGenerator": CounterpointGenerator,
}

export const pagesConfig = {
    mainPage: "CounterpointGenerator",
    Pages: PAGES,
    Layout: __Layout,
};