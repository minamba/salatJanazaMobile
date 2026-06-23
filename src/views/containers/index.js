import { connect } from 'react-redux';
import { BaseApp } from '../components';

function mapStateToProps(state) {
  return {
    // entity state will be mapped here via entity prompt
  };
}

export const AppContainer = connect(mapStateToProps)(BaseApp);
export default AppContainer;
